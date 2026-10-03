import { addStoryFileListener, isComponentFile, normalizeFilePath } from './shared';

import type { HmrContext, Plugin, ViteDevServer } from 'vite';

const VIRTUAL = 'virtual:ember-storybook';
const RESOLVED = '\0' + VIRTUAL;

export interface ContributorAPI {
  contribute(name: string, data: Record<string, unknown>): void;
  getContributions(): Map<string, Record<string, unknown>>;
  invalidate?: () => void;
}

type ComponentReference = Record<string, string | undefined>;

function normalizeReference(ref: ComponentReference): ComponentReference {
  return ref.file ? { ...ref, file: normalizeFilePath(ref.file) } : ref;
}

/** Makes the component file paths in a `component` or `subcomponents` contribution project-relative. */
function normalizeContribution(name: string, value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;

  if (name === 'component') return normalizeReference(value as ComponentReference);

  if (name === 'subcomponents') {
    return Object.fromEntries(
      Object.entries(value as Record<string, ComponentReference>).map(([key, ref]) => [
        key,
        normalizeReference(ref)
      ])
    );
  }

  return value;
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
          (merged[normalizeFilePath(filePath)] ??= {})[name] = normalizeContribution(name, value);
        }
      }

      return {
        code: `export default ${JSON.stringify(merged)};`,
        map: undefined
      };
    },

    handleHotUpdate(ctx: HmrContext) {
      // eslint-disable-next-line unicorn/prefer-early-return
      if (isComponentFile(ctx.file)) {
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
