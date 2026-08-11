import { readFile } from 'node:fs/promises';

import { Preprocessor } from 'content-tag';
import { type CsfOptions, loadCsf } from 'storybook/internal/csf-tools';

import { registerStoryFile } from './shared';

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

    registerStoryFile(fileName);

    return inputs;
  }
};
