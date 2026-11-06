import path from 'node:path';

import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';

import { buildArgTypes } from '../../client/docs/extractArgTypes';
import { byAbsolutePath, componentFileOf, describeComponent } from '../manifest';
import { parseStoryFile } from '../parser';
import { createSignatureExtractor, type SignatureExtractor } from './docgen';

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

function docgenPayload(
  extract: SignatureExtractor,
  entry: IndexEntry,
  storyPath: string
): DocgenPayload {
  const id = getComponentIdFromEntry(entry);
  const parsed = parseStoryFile(path.resolve(storyPath));
  const componentFile = componentFileOf(parsed);
  const signatures = componentFile
    ? byAbsolutePath(extract([componentFile])).get(componentFile)
    : undefined;
  const { signature, name, description, apiDescription } = describeComponent(
    parsed,
    signatures,
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
    renderer: 'ember'
  };
}

/**
 * The docgen server's provider (`experimental_docgenProvider`). Storybook
 * loads this module in a worker and asks it for one component at a time; the
 * TypeScript program is built on the first request and reused after that.
 * Storybook's own `createLazyDocgenMiddleware` takes only `.js`/`.ts` story
 * files before Storybook 11.
 */
export function createDocgenProvider(): DocgenMiddleware {
  // Created on the first request; `current` is unset without a tsconfig.
  let extractor: undefined | { current: SignatureExtractor | undefined };

  return (next) => (input) => {
    const storyPath = emberStoryFileOf(input.entry);

    if (!storyPath) return next(input);

    extractor ??= { current: createSignatureExtractor() };

    return extractor.current
      ? Promise.resolve(docgenPayload(extractor.current, input.entry, storyPath))
      : next(input);
  };
}
