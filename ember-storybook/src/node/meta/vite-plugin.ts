import { existsSync } from 'node:fs';
import path from 'node:path';

import { readAllMetaCaches } from './cache';

import type { Plugin, ResolvedConfig } from 'vite';

const VIRTUAL_MODULE = 'virtual:ember-storybook-meta';
const RESOLVED_ID = '\0' + VIRTUAL_MODULE;

export function emberStorybookMetaPlugin(): Plugin {
  let root: string;
  let cacheDir: string;

  return {
    name: 'ember-storybook-meta',

    configResolved(config: ResolvedConfig) {
      root = config.root;
      cacheDir = path.join(root, 'node_modules', '.cache', 'ember-storybook');
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE) return RESOLVED_ID;
    },

    load(id) {
      if (id !== RESOLVED_ID) return;

      const meta = readAllMetaCaches(root);

      return {
        code: `export default ${JSON.stringify(meta)};`,
        map: undefined
      };
    },

    configureServer(server) {
      if (!existsSync(cacheDir)) return;

      server.watcher.add(cacheDir);

      server.watcher.on('change', (filePath) => {
        if (!filePath.startsWith(cacheDir)) return;

        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);

        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }
      });
    }
  };
}
