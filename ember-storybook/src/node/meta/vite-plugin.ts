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
  subcomponents: Record<string, Record<string, ComponentMeta>>;
  componentMap: Record<string, ComponentMap>;
} {
  const storyResult = parseStoryFile(file);

  if (!storyResult?.meta.component) {
    return { meta: {}, component: {}, subcomponents: {}, componentMap: {} };
  }

  // The declaration maps of the referenced component files (the component and
  // its subcomponents). Contributed under the `meta` name so each merges into
  // its component file's entry, alongside `signatures`.
  const componentMap: Record<string, ComponentMap> = {};

  for (const ref of [storyResult.component, ...Object.values(storyResult.subcomponents)]) {
    const compMeta = ref.file
      ? parseComponentFile(path.resolve(PROJECT_ROOT, ref.file))
      : undefined;

    if (ref.file && compMeta) {
      componentMap[ref.file] = compMeta;
    }
  }

  const hasSubcomponents = Object.keys(storyResult.subcomponents).length > 0;

  return {
    meta: { [file]: storyResult.meta },
    component: {
      [file]: {
        file: storyResult.component.file,
        signatureName: storyResult.component.signatureName,
        name: storyResult.component.name
      }
    },
    subcomponents: hasSubcomponents ? { [file]: storyResult.subcomponents } : {},
    componentMap
  };
}

export function metaContributor(api: ContributorAPI): Plugin {
  let fileMeta: Record<string, StaticMeta> = {};
  let fileComponent: Record<string, ComponentMeta> = {};
  let fileSubcomponents: Record<string, Record<string, ComponentMeta>> = {};
  let fileComponentMaps: Record<string, ComponentMap> = {};

  function recontribute() {
    // Story metas and component declaration maps share the `meta`
    // contribution (their keys never collide).
    api.contribute('meta', { ...fileMeta, ...fileComponentMaps });
    api.contribute('component', { ...fileComponent });
    api.contribute('subcomponents', { ...fileSubcomponents });
  }

  function syncAll() {
    let meta: Record<string, StaticMeta> = {};
    let component: Record<string, ComponentMeta> = {};
    let subcomponents: Record<string, Record<string, ComponentMeta>> = {};
    let componentMaps: Record<string, ComponentMap> = {};

    for (const file of getStoryFiles()) {
      const data = computeDataForStory(file);

      meta = { ...meta, ...data.meta };
      component = { ...component, ...data.component };
      subcomponents = { ...subcomponents, ...data.subcomponents };
      componentMaps = { ...componentMaps, ...data.componentMap };
    }

    fileMeta = meta;
    fileComponent = component;
    fileSubcomponents = subcomponents;
    fileComponentMaps = componentMaps;
    recontribute();
  }

  function storiesForComponent(compPath: string): string[] {
    const references = (storyPath: string) => [
      fileComponent[storyPath],
      ...Object.values(fileSubcomponents[storyPath] ?? {})
    ];

    return Object.keys(fileComponent).filter((storyPath) =>
      references(storyPath).some((ref) => ref.file === compPath)
    );
  }

  function syncStory(storyPath: string) {
    const data = computeDataForStory(storyPath);

    fileMeta = { ...fileMeta, ...data.meta };
    fileComponent = { ...fileComponent, ...data.component };
    fileComponentMaps = { ...fileComponentMaps, ...data.componentMap };

    // Replaced rather than merged, so a story file can drop its subcomponents.
    fileSubcomponents = {
      ...Object.fromEntries(Object.entries(fileSubcomponents).filter(([key]) => key !== storyPath)),
      ...data.subcomponents
    };
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
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete fileSubcomponents[changedPath];
        recontribute();
      });
    }
  };
}
