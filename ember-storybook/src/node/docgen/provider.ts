import path from 'node:path';

import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';

import { buildArgTypes } from '../../client/docs/extractArgTypes';
import { componentFileOf, describeComponent } from '../manifest';
import { parseStoryFile } from '../parser';
import { normalizeFilePath } from '../shared';
import { batched, createSignatureExtractor, signaturesFor } from './docgen';

import type {
  DocgenMiddleware,
  DocgenPayload,
  IndexEntry,
  StrictArgTypes
} from 'storybook/internal/types';

/**
 * The Ember story file an index entry belongs to. Other renderers' files are
 * for their providers. An autodocs entry's own `importPath` is its story file.
 */
export function emberStoryFileOf(entry: IndexEntry): string | undefined {
  const storyPath = getStoryImportPathFromEntry(entry) ?? entry.importPath;

  return /\.stories\.g[jt]s$/.test(storyPath) ? storyPath : undefined;
}

async function docgenPayload(
  signaturesOf: ReturnType<typeof batched>,
  entry: IndexEntry,
  storyPath: string
): Promise<DocgenPayload> {
  const id = getComponentIdFromEntry(entry);
  const parsed = parseStoryFile(path.resolve(storyPath));
  const componentFile = componentFileOf(parsed);
  const emberSignatures = componentFile
    ? signaturesFor(componentFile, await signaturesOf(componentFile))
    : {};
  const { signature, name, description, apiDescription } = describeComponent(
    parsed,
    componentFile ? emberSignatures[normalizeFilePath(componentFile)] : undefined,
    entry.title.split('/').at(-1) ?? id
  );

  return {
    id,
    name,
    path: storyPath,
    description,
    jsDocTags: {},
    argTypes: signature ? (buildArgTypes(signature) as StrictArgTypes) : undefined,
    apiDescription,
    renderer: 'ember',
    // What the docs page and "Show code" read, in place of a bundle of every
    // signature. A string, because Storybook's channel cuts deeper values short.
    emberSignatures: JSON.stringify(emberSignatures)
  };
}

/**
 * The docgen server's provider (`experimental_docgenProvider`). Storybook
 * loads this module in a worker and asks it for components, one request each;
 * the TypeScript program is built on the first request and reused after that.
 * Storybook's own `createLazyDocgenMiddleware` takes only `.js`/`.ts` story
 * files before Storybook 11.
 */
export function createDocgenProvider(): DocgenMiddleware {
  // Created on the first request; `current` is unset without a tsconfig.
  let signaturesOf: undefined | { current: ReturnType<typeof batched> | undefined };

  return (next) => (input) => {
    const storyPath = emberStoryFileOf(input.entry);

    if (!storyPath) return next(input);

    if (!signaturesOf) {
      const extract = createSignatureExtractor();

      signaturesOf = { current: extract ? batched(extract) : undefined };
    }

    return signaturesOf.current
      ? docgenPayload(signaturesOf.current, input.entry, storyPath)
      : next(input);
  };
}
