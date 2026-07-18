import { parseStoryFile } from '../parser';
import { getStoryFiles, isComponentFile, isStoryFile } from '../shared';
import { type ContributorAPI } from '../vite-plugin-orchestrator';

import type { StaticMeta } from 'storybook/internal/csf-tools';
import type { Plugin } from 'vite';

export interface ComponentMeta {
  file?: string;
  signatureName?: string;
}

function computeDataForStory(file: string): {
  meta: Record<string, StaticMeta>;
  component: Record<string, ComponentMeta>;
} {
  const storyResult = parseStoryFile(file);

  if (!storyResult?.meta.component) {
    return { meta: {}, component: {} };
  }

  return {
    meta: { [file]: storyResult.meta },
    component: {
      [file]: {
        file: storyResult.component.file,
        signatureName: storyResult.component.signatureName
      }
    }
  };
}

export function metaContributor(api: ContributorAPI): Plugin {
  let fileMeta: Record<string, StaticMeta> = {};
  let fileComponent: Record<string, ComponentMeta> = {};

  function recontribute() {
    api.contribute('meta', { ...fileMeta });
    api.contribute('component', { ...fileComponent });
  }

  function syncAll() {
    let meta: Record<string, StaticMeta> = {};
    let component: Record<string, ComponentMeta> = {};

    for (const file of getStoryFiles()) {
      const data = computeDataForStory(file);

      meta = { ...meta, ...data.meta };
      component = { ...component, ...data.component };
    }

    fileMeta = meta;
    fileComponent = component;
    recontribute();
  }

  function storiesForComponent(compPath: string): string[] {
    return Object.entries(fileComponent)
      .filter(([, v]) => v.file === compPath)
      .map(([k]) => k);
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
          const data = computeDataForStory(changedPath);

          fileMeta = { ...fileMeta, ...data.meta };
          fileComponent = { ...fileComponent, ...data.component };
          recontribute();
        }
      });

      server.watcher.on('change', (changedPath) => {
        if (isStoryFile(changedPath)) {
          const data = computeDataForStory(changedPath);

          fileMeta = { ...fileMeta, ...data.meta };
          fileComponent = { ...fileComponent, ...data.component };
          recontribute();
        } else if (isComponentFile(changedPath)) {
          for (const storyPath of storiesForComponent(changedPath)) {
            const data = computeDataForStory(storyPath);

            fileMeta = { ...fileMeta, ...data.meta };
            fileComponent = { ...fileComponent, ...data.component };
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
