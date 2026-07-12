import { readFile } from 'node:fs/promises';

import { Preprocessor } from 'content-tag';
import { type CsfOptions, loadCsf } from 'storybook/internal/csf-tools';

import { writeMetaCache } from './meta/cache';
import { extractStoryMeta } from './meta/parser';

import type { Indexer, IndexerOptions, IndexInput } from 'storybook/internal/types';

function parse(fileName: string, code: string) {
  const preprocessor = new Preprocessor();

  return preprocessor.process(code, { filename: fileName });
}

export const readCsf = async (fileName: string, options: CsfOptions) => {
  const code = await readFile(fileName, 'utf8');
  const result = parse(fileName, code);

  return loadCsf(result.code, { ...options, fileName });
};

export const emberIndexer: Indexer = {
  test: /\.stories\.g[tj]s$/,

  createIndex: async (fileName: string, options: IndexerOptions): Promise<IndexInput[]> => {
    const rawCode = await readFile(fileName, 'utf8');
    const result = parse(fileName, rawCode);
    const csf = loadCsf(result.code, { ...options, fileName });
    const parsed = csf.parse();
    const inputs = parsed.indexInputs;

    const stories: { id: string }[] = (parsed as { stories?: { id: string }[] }).stories ?? [];
    const storyIds = new Map<string, string>();
    let storyIdx = 0;

    for (const input of inputs) {
      if (input.type === 'story') {
        const story = stories[storyIdx++];

        if (story.id) {
          storyIds.set(input.exportName, story.id);
        }
      }
    }

    try {
      const meta = await extractStoryMeta(rawCode, fileName, storyIds);

      await writeMetaCache(process.cwd(), fileName, meta);
    } catch (error) {
      console.warn(`[ember-storybook] failed to extract meta for ${fileName}:`, error);
    }

    return inputs;
  }
};
