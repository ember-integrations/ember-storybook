import path from 'node:path';

import { parseComponentFile, parseStoryFile } from '../parser';
import { getStoryFiles, isComponentFile, isStoryFile, PROJECT_ROOT } from '../shared';
import { type ContributorAPI } from '../vite-plugin-orchestrator';

import type { ComponentMap } from '../parser';
import type { StaticMeta } from 'storybook/internal/csf-tools';
import type { Plugin } from 'vite';

export interface ComponentMeta {
  file?: string;
  signatureName?: string;
  name?: string;
}

function computeDataForStory(file: string): {
  meta: Record<string, StaticMeta>;
  component: Record<string, ComponentMeta>;
  componentMap: Record<string, ComponentMap>;
} {
  const storyResult = parseStoryFile(file);

  if (!storyResult?.meta.component) {
    return { meta: {}, component: {}, componentMap: {} };
  }

  const compPath = storyResult.component.file;
  const compMeta = compPath ? parseComponentFile(path.resolve(PROJECT_ROOT, compPath)) : undefined;

  return {
    meta: { [file]: storyResult.meta },
    component: {
      [file]: {
        file: storyResult.component.file,
        signatureName: storyResult.component.signatureName,
        name: storyResult.component.name
      }
    },
    // The declaration map of the referenced component file. Contributed
    // under the `meta` name so it merges into the component file's entry,
    // alongside `signatures`.
    componentMap: compPath && compMeta ? { [compPath]: compMeta } : {}
  };
}

export function metaContributor(api: ContributorAPI): Plugin {
  let fileMeta: Record<string, StaticMeta> = {};
  let fileComponent: Record<string, ComponentMeta> = {};
  let fileComponentMaps: Record<string, ComponentMap> = {};

  function recontribute() {
    // Story metas and component declaration maps share the `meta`
    // contribution (their keys never collide).
    api.contribute('meta', { ...fileMeta, ...fileComponentMaps });
    api.contribute('component', { ...fileComponent });
  }

  function syncAll() {
    let meta: Record<string, StaticMeta> = {};
    let component: Record<string, ComponentMeta> = {};
    let componentMaps: Record<string, ComponentMap> = {};

    for (const file of getStoryFiles()) {
      const data = computeDataForStory(file);

      meta = { ...meta, ...data.meta };
      component = { ...component, ...data.component };
      componentMaps = { ...componentMaps, ...data.componentMap };
    }

    fileMeta = meta;
    fileComponent = component;
    fileComponentMaps = componentMaps;
    recontribute();
  }

  function storiesForComponent(compPath: string): string[] {
    return Object.entries(fileComponent)
      .filter(([, v]) => v.file === compPath)
      .map(([k]) => k);
  }

  function syncStory(storyPath: string) {
    const data = computeDataForStory(storyPath);

    fileMeta = { ...fileMeta, ...data.meta };
    fileComponent = { ...fileComponent, ...data.component };
    fileComponentMaps = { ...fileComponentMaps, ...data.componentMap };
  }

  return {
    name: 'ember-storybook:meta',

    buildStart() {
      syncAll();
    },

    configureServer(server) {
      server.watcher.on('add', (changedPath) => {
        // eslint-disable-next-line unicorn/prefer-early-return
        if (isStoryFile(changedPath)) {
          syncStory(changedPath);
          recontribute();
        }
      });

      server.watcher.on('change', (changedPath) => {
        if (isStoryFile(changedPath)) {
          syncStory(changedPath);
          recontribute();
        } else if (isComponentFile(changedPath)) {
          for (const storyPath of storiesForComponent(changedPath)) {
            syncStory(storyPath);
          }

          recontribute();
        }
      });

      server.watcher.on('unlink', (changedPath) => {
        if (!(isStoryFile(changedPath) || isComponentFile(changedPath))) {
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete fileMeta[changedPath];
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete fileComponent[changedPath];
        recontribute();
      });
    }
  };
}
