import { parseStoryFile } from '../parser';
import { getStoryFiles, isStoryFile } from '../shared';
import { type ContributorAPI } from '../vite-plugin-orchestrator';

import type { StorySource } from '../types';
import type { Plugin } from 'vite';

export function sourceContributor(api: ContributorAPI): Plugin {
  let fileMeta: Record<string, Record<string, StorySource>> = {};

  function contribute() {
    api.contribute('source', { ...fileMeta });
  }

  function extractSource(filePath: string): Record<string, StorySource> {
    const result = parseStoryFile(filePath);
    const output: Record<string, StorySource> = {};

    for (const story of result?.stories ?? []) {
      output[story.id] = {
        inlineTemplate: story.inlineTemplate,
        componentName: result?.component.name ?? result?.component.signatureName,
        signatureName: result?.component.signatureName
      };
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
      const data: Record<string, Record<string, StorySource>> = {};

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
