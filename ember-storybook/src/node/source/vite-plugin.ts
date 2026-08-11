import { parseStoryFile } from '../parser';
import { getStoryFiles, isStoryFile } from '../shared';
import { type ContributorAPI } from '../vite-plugin-orchestrator';

import type { Plugin } from 'vite';

export function sourceContributor(api: ContributorAPI): Plugin {
  let fileMeta: Record<string, Record<string, string | undefined>> = {};

  function contribute() {
    api.contribute('source', { ...fileMeta });
  }

  function extractSource(filePath: string): Record<string, string | undefined> {
    const result = parseStoryFile(filePath);
    const output: Record<string, string | undefined> = {};

    for (const story of result?.stories ?? []) {
      output[story.id] = story.inlineTemplate;
    }

    return output;
  }

  function refreshMeta(storyPath: string) {
    try {
      fileMeta[storyPath] = extractSource(storyPath);
      contribute();
    } catch {
      // file extraction failed
    }
  }

  return {
    name: 'ember-storybook:source',

    buildStart() {
      const files = getStoryFiles().filter((f) => isStoryFile(f));
      const data: Record<string, Record<string, string | undefined>> = {};

      for (const file of files) {
        data[file] = extractSource(file);
      }

      fileMeta = data;
      contribute();
    },

    configureServer(server) {
      server.watcher.on('add', (storyPath) => {
        if (!isStoryFile(storyPath)) return;
        refreshMeta(storyPath);
      });

      server.watcher.on('change', (storyPath) => {
        if (!isStoryFile(storyPath)) return;
        refreshMeta(storyPath);
      });

      server.watcher.on('unlink', (storyPath) => {
        if (!isStoryFile(storyPath)) return;

        Reflect.deleteProperty(fileMeta, storyPath);
        contribute();
      });
    }
  };
}
