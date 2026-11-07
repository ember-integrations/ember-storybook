import path from 'node:path';

import { getComponentIdFromEntry } from 'storybook/internal/common';
import { getService } from 'storybook/internal/core-server';

import { parseEmberSignatures } from '../client/docs/docgen-payload';
import { emberStoryFileOf } from './docgen/provider';
import { componentFileOf, describeComponent, storyExamples } from './manifest';
import { parseStoryFile } from './parser';
import { normalizeFilePath } from './shared';

import type { ComponentSignature } from 'ember-docgen';
import type { DocgenPayload, IndexEntry, StoryDocsProvider } from 'storybook/internal/types';

/** The component's signatures, from the docgen server's payload (see `./docgen/provider`). */
async function signaturesOf(
  componentId: string,
  componentFile: string
): Promise<Record<string, ComponentSignature> | undefined> {
  const { docgen } = (
    getService('core/docgen', { internal: true }) as {
      queries: {
        docgen: {
          get(input: { id: string }): DocgenPayload | undefined;
          loaded(input: { id: string }): Promise<DocgenPayload | undefined>;
        };
      };
    }
  ).queries;
  const payload = docgen.get({ id: componentId }) ?? (await docgen.loaded({ id: componentId }));

  return parseEmberSignatures(payload)[normalizeFilePath(componentFile)];
}

/**
 * The docgen server's story docs (`experimental_storyDocsProvider`): each
 * story's snippet and the component's import. Snippets of stories without a
 * template of their own need the signature, to tell blocks from arguments; it
 * comes from the docgen service, so this process runs no TypeScript.
 */
export function emberStoryDocsProvider(
  next: StoryDocsProvider,
  entriesOf: (storyPath: string) => Promise<IndexEntry[]>
): StoryDocsProvider {
  return async (input) => {
    const storyPath = emberStoryFileOf(input.entry);

    if (!storyPath) return next(input);

    const id = getComponentIdFromEntry(input.entry);
    const parsed = parseStoryFile(path.resolve(storyPath));
    const componentFile = componentFileOf(parsed);

    const signatures = componentFile ? await signaturesOf(id, componentFile) : undefined;
    const component = describeComponent(
      parsed,
      signatures,
      input.entry.title.split('/').at(-1) ?? id
    );
    const examples = storyExamples(parsed, component, await entriesOf(storyPath));

    return {
      id,
      name: component.name,
      path: storyPath,
      import: component.import,
      stories: Object.fromEntries(examples.map((example) => [example.id, example]))
    };
  };
}
