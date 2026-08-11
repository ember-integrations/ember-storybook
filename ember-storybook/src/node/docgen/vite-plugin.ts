import path from 'node:path';

import { parseStoryFile } from '../parser';
import { getStoryFiles, isComponentFile, isStoryFile } from '../shared';
import { type ContributorAPI } from '../vite-plugin-orchestrator';
import { runTypeDoc } from './docgen';

import type { ComponentSignatureMap } from 'ember-docgen';
import type { Plugin } from 'vite';

interface ComponentRef {
  componentName: string;
  componentPath: string;
}

interface SignaturesState {
  storyToRef: Map<string, ComponentRef>;
  signatures: ComponentSignatureMap;
}

function isReferenced(state: SignaturesState, componentFile: string): boolean {
  const abs = path.resolve(componentFile);

  for (const r of state.storyToRef.values()) {
    if (r.componentPath === abs) return true;
  }

  return false;
}

function resolveComponentRef(storyFilePath: string): ComponentRef | undefined {
  const result = parseStoryFile(storyFilePath);

  if (!result?.component.file) return undefined;

  const componentPath = path.resolve(result.component.file);

  console.log('[ember-storybook] resolveComponentRef', storyFilePath, {
    componentName: result.meta.component,
    componentPath
  });

  return { componentName: result.meta.component ?? '', componentPath };
}

async function addSignatures(
  state: SignaturesState,
  componentPaths: string[]
): Promise<SignaturesState> {
  const absPaths = componentPaths.map((cp) => path.resolve(cp));
  const missing = absPaths.filter((abs) => !Object.hasOwn(state.signatures, abs));

  if (missing.length === 0) return state;

  const newSigs = await runTypeDoc(missing);

  console.log('[ember-storybook] addSignatures', {
    asked: componentPaths,
    missing,
    newKeys: Object.keys(newSigs)
  });

  const merged = { ...state.signatures };

  for (const [filePath, compSigs] of Object.entries(newSigs)) {
    merged[filePath] = { ...merged[filePath], ...compSigs };
  }

  return { ...state, signatures: merged };
}

export function signaturesContributor(api: ContributorAPI): Plugin {
  let state: SignaturesState = {
    storyToRef: new Map(),
    signatures: {}
  };

  function contributeState() {
    console.log('[ember-storybook] contributeState keys:', Object.keys(state.signatures));
    api.contribute('signatures', state.signatures);
  }

  function discoverAll() {
    const files = getStoryFiles();

    console.log('[ember-storybook] discoverAll story files:', files);

    const next = new Map<string, ComponentRef>();

    for (const file of files) {
      const ref = resolveComponentRef(file);

      if (ref) {
        next.set(file, ref);
      }
    }

    console.log('[ember-storybook] discoverAll resolved refs:', [...next]);

    state.storyToRef = next;
  }

  async function processStoryAdd(storyFile: string) {
    console.log('[ember-storybook] processStoryAdd', storyFile);

    const ref = resolveComponentRef(storyFile);

    if (!ref) return;

    state.storyToRef.set(storyFile, ref);
    state = await addSignatures(state, [ref.componentPath]);
    contributeState();
  }

  function processStoryChange(storyFile: string) {
    console.log('[ember-storybook] processStoryChange', storyFile);

    state.storyToRef.delete(storyFile);

    const ref = resolveComponentRef(storyFile);

    if (ref) {
      state.storyToRef.set(storyFile, ref);
    }

    contributeState();
  }

  function processStoryUnlink(storyFile: string) {
    console.log('[ember-storybook] processStoryUnlink', storyFile);

    state.storyToRef.delete(storyFile);
    contributeState();
  }

  async function processComponentChange(componentFile: string) {
    console.log('[ember-storybook] processComponentChange', componentFile);

    const absFile = path.resolve(componentFile);

    if (!isReferenced(state, absFile)) return;

    const newSigs = await runTypeDoc([absFile]);

    console.log('newSigs for', absFile, JSON.stringify(newSigs, undefined, 2));

    const merged = { ...state.signatures };

    for (const [filePath, compSigs] of Object.entries(newSigs)) {
      merged[filePath] = { ...merged[filePath], ...compSigs };
    }

    state = { ...state, signatures: merged };
    contributeState();
  }

  return {
    name: 'ember-storybook:signatures',

    async buildStart() {
      console.log('[ember-storybook] buildStart - signatures contributor');
      discoverAll();

      const allPaths = [...new Set(Array.from(state.storyToRef.values(), (r) => r.componentPath))];

      state = await addSignatures(state, allPaths);
      contributeState();
    },

    configureServer(server) {
      server.watcher.on('add', (changedFile) => {
        if (isStoryFile(changedFile)) {
          void processStoryAdd(changedFile);
        } else if (isComponentFile(changedFile)) {
          void processComponentChange(changedFile);
        }
      });

      server.watcher.on('change', (changedFile) => {
        console.log('file change', changedFile);

        if (isStoryFile(changedFile)) {
          processStoryChange(changedFile);
        } else if (isComponentFile(changedFile)) {
          void processComponentChange(changedFile);
        }
      });

      server.watcher.on('unlink', (changedFile) => {
        if (isStoryFile(changedFile)) {
          processStoryUnlink(changedFile);
        } else if (isComponentFile(changedFile)) {
          void processComponentChange(changedFile);
        }
      });
    }
  };
}
