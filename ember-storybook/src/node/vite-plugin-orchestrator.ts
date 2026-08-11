import { addStoryFileListener, isComponentFile, normalizeFilePath } from './shared';

import type { HmrContext, Plugin, ViteDevServer } from 'vite';

const VIRTUAL = 'virtual:ember-storybook';
const RESOLVED = '\0' + VIRTUAL;

export interface ContributorAPI {
  contribute(name: string, data: Record<string, unknown>): void;
  getContributions(): Map<string, Record<string, unknown>>;
  invalidate?: () => void;
}

export function emberStorybookVitePlugin(api: ContributorAPI): Plugin {
  let server: ViteDevServer | undefined;

  function invalidate() {
    if (!server) return;

    const mod = server.moduleGraph.getModuleById(RESOLVED);

    if (mod) {
      server.moduleGraph.invalidateModule(mod);
    }

    server.ws.send({ type: 'full-reload' });
  }

  addStoryFileListener(() => {
    invalidate();
  });

  return {
    name: 'ember-storybook',

    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED;
    },

    load(id) {
      if (id !== RESOLVED) return;

      const contributions = api.getContributions();
      const merged: Record<string, Record<string, unknown>> = {};

      for (const [name, data] of contributions) {
        for (const [filePath, value] of Object.entries(data)) {
          const relPath = normalizeFilePath(filePath);
          let normalizedValue = value;

          if (name === 'component' && typeof value === 'object' && value !== null) {
            const compValue = value as Record<string, string | undefined>;

            if (compValue.file) {
              normalizedValue = { ...compValue, file: normalizeFilePath(compValue.file) };
            }
          }

          (merged[relPath] ??= {})[name] = normalizedValue;
        }
      }

      console.log('[ember-storybook] merged (JS):', merged);
      console.log('[ember-storybook] merged (JSON):', JSON.stringify(merged, undefined, 2));

      return {
        code: `export default ${JSON.stringify(merged)};`,
        map: undefined
      };
    },

    handleHotUpdate(ctx: HmrContext) {
      // eslint-disable-next-line unicorn/prefer-early-return
      if (isComponentFile(ctx.file)) {
        console.log('[ember-storybook] handleHotUpdate: component file changed:', ctx.file);

        const virtualMod = ctx.server.moduleGraph.getModuleById(RESOLVED);

        if (virtualMod) {
          ctx.server.moduleGraph.invalidateModule(virtualMod);
        }

        ctx.server.ws.send({ type: 'full-reload' });

        return [];
      }
    },

    configureServer(srv) {
      server = srv;
      api.invalidate = invalidate;
    }
  };
}
