import { signaturesContributor } from './docgen/vite-plugin';
import { metaContributor } from './meta/vite-plugin';
import { sourceContributor } from './source/vite-plugin';
import { type ContributorAPI, emberStorybookVitePlugin } from './vite-plugin-orchestrator';

import type { Plugin } from 'vite';

export interface EmberStorybookPluginOptions {
  /**
   * Resolves once Storybook has indexed the stories, which is what registers
   * the story files (see `emberIndexer`).
   */
  waitForStoryIndex?: () => Promise<unknown>;
}

export function emberStorybookPlugin(options: EmberStorybookPluginOptions = {}): Plugin[] {
  const contributions = new Map<string, Record<string, unknown>>();
  let isBuild = false;

  const api: ContributorAPI = {
    contribute(name, data) {
      contributions.set(name, data);
      api.invalidate?.();
    },
    getContributions: () => contributions,
    async storyFilesReady() {
      // `storybook build` indexes the stories and builds the preview at the
      // same time, so the contributors' `buildStart` can run before any story
      // file is registered: the build then ships no args tables or sources.
      // `storybook dev` indexes before it starts Vite, and keeps contributors
      // up to date through the watcher, so it doesn't wait.
      if (isBuild) await options.waitForStoryIndex?.();
    }
  };

  const buildMode: Plugin = {
    name: 'ember-storybook:build-mode',
    configResolved(config) {
      isBuild = config.command === 'build';
    }
  };

  return [
    buildMode,
    emberStorybookVitePlugin(api),
    metaContributor(api),
    sourceContributor(api),
    signaturesContributor(api)
  ];
}
