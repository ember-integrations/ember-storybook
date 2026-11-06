import { signaturesContributor } from './docgen/vite-plugin';
import { metaContributor } from './meta/vite-plugin';
import { sourceContributor } from './source/vite-plugin';
import { type ContributorAPI, emberStorybookVitePlugin } from './vite-plugin-orchestrator';

import type { Plugin } from 'vite';

/**
 * `signatures: false` leaves component signatures out of the bundle, for the
 * docgen server, which extracts each component when the docs ask for it.
 */
export function emberStorybookPlugin({ signatures = true } = {}): Plugin[] {
  const contributions = new Map<string, Record<string, unknown>>();

  const api: ContributorAPI = {
    contribute(name, data) {
      contributions.set(name, data);
      api.invalidate?.();
    },
    getContributions: () => contributions
  };

  return [
    emberStorybookVitePlugin(api),
    metaContributor(api),
    sourceContributor(api),
    ...(signatures ? [signaturesContributor(api)] : [])
  ];
}
