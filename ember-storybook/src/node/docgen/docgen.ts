import { existsSync } from 'node:fs';
import path from 'node:path';

import { analyze, parseFile } from 'ember-docgen';

import { unwrapBlockParams } from '../../client/docs/block-params';
import { normalizeFilePath } from '../shared';

import type { ComponentSignatureMap } from 'ember-docgen';

/**
 * Resolve the directory of the project's tsconfig, replicating TypeDoc's
 * discovery: walk up from cwd. parseFile pins TypeDoc's displayBasePath to
 * this directory, so analyze's JSON paths are relative to it.
 */
function resolveTsconfigBase(): string | undefined {
  const findUp = (dir: string): string | undefined => {
    if (existsSync(path.join(dir, 'tsconfig.json'))) {
      return dir;
    }

    const parent = path.dirname(dir);

    return parent === dir ? undefined : findUp(parent);
  };

  return findUp(process.cwd());
}

/**
 * Rewrite componentRef.filePath from tsconfig-relative to project-root-relative
 * (`./`-prefixed) paths, so consumers can look signatures up in the meta map.
 */
function rewriteFilePaths(mapped: ComponentSignatureMap, base: string): void {
  for (const compSigs of Object.values(mapped)) {
    for (const compSig of Object.values(compSigs)) {
      for (const blockInfo of Object.values(compSig.blocks)) {
        for (const param of unwrapBlockParams(blockInfo.params)) {
          if (param.componentRef?.filePath) {
            param.componentRef.filePath = normalizeFilePath(
              path.resolve(base, param.componentRef.filePath)
            );
          }
        }
      }
    }
  }
}

export async function runTypeDoc(entryPoints: string[]): Promise<ComponentSignatureMap> {
  if (entryPoints.length === 0) {
    return {};
  }

  const base = resolveTsconfigBase();

  if (!base) {
    return {};
  }

  try {
    // Component signatures, keyed by absolute entry-point paths.
    // Transitive subcomponents (not in the entry points) are included too.
    const mapped: ComponentSignatureMap = {};

    for (const file of entryPoints) {
      const json = await parseFile(file);
      const extracted = analyze(json);

      for (const [relPath, compSigs] of Object.entries(extracted)) {
        const absKey = path.resolve(base, relPath);

        mapped[absKey] ??= {};
        Object.assign(mapped[absKey], compSigs);
      }
    }

    rewriteFilePaths(mapped, base);

    return mapped;
  } catch (error) {
    console.warn('[ember-storybook] TypeDoc extraction failed:', error);

    return {};
  }
}
