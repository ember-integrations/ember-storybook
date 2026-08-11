import { signaturesContributor } from './docgen/vite-plugin';
import { metaContributor } from './meta/vite-plugin';
import { sourceContributor } from './source/vite-plugin';
import { type ContributorAPI, emberStorybookVitePlugin } from './vite-plugin-orchestrator';

import type { Plugin } from 'vite';

export function emberStorybookPlugin(): Plugin[] {
  const contributions = new Map<string, Record<string, unknown>>();

  const api: ContributorAPI = {
    contribute(name, data) {
      console.log(`[ember-storybook] contribute "${name}":`, data);
      contributions.set(name, data);
      api.invalidate?.();
    },
    getContributions: () => contributions
  };

  return [
    emberStorybookVitePlugin(api),
    metaContributor(api),
    sourceContributor(api),
    signaturesContributor(api)
  ];
}
