import path from 'node:path';

import { getComponentIdFromEntry } from 'storybook/internal/common';

import { createSignatureExtractor, type SignatureExtractor } from './docgen/docgen';
import { emberStoryFileOf } from './docgen/provider';
import { byAbsolutePath, componentFileOf, describeComponent, storyExamples } from './manifest';
import { parseStoryFile } from './parser';

import type { IndexEntry, StoryDocsProvider } from 'storybook/internal/types';

let extractor: SignatureExtractor | undefined;

/**
 * The docgen server's story docs (`experimental_storyDocsProvider`): each
 * story's snippet and the component's import. Snippets of stories without a
 * template of their own need the signature, to tell blocks from arguments.
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

    extractor ??= createSignatureExtractor();

    const signatures = componentFile
      ? byAbsolutePath(extractor?.([componentFile]) ?? {}).get(componentFile)
      : undefined;
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
