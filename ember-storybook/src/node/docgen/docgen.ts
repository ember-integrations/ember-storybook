import { existsSync } from 'node:fs';
import path from 'node:path';

import { createDocgenSession, parseSignatures } from 'ember-docgen';

import { unwrapBlockParams } from '../../client/docs/block-params';
import { normalizeFilePath, PROJECT_ROOT } from '../shared';

import type { ComponentSignature, ComponentSignatureMap } from 'ember-docgen';

/**
 * Resolve the directory of the project's tsconfig, replicating TypeDoc's
 * discovery: walk up from cwd. parseSignatures keys its output relative
 * to this directory.
 */
export function resolveTsconfigBase(): string | undefined {
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

export type SignatureExtractor = (entryPoints: string[]) => ComponentSignatureMap;

/**
 * `runTypeDoc` for callers that ask for a few components at a time, such as
 * the docgen server's worker: files parsed by earlier calls are reused.
 */
export function createSignatureExtractor(): SignatureExtractor | undefined {
  const base = resolveTsconfigBase();
  const session = base
    ? createDocgenSession({ tsconfigFile: path.join(base, 'tsconfig.json') })
    : undefined;

  if (!base || !session) return undefined;

  return (entryPoints) => {
    const existing = entryPoints.filter((entryPoint) => existsSync(entryPoint));

    if (existing.length === 0) return {};

    try {
      const extracted = session.parseSignatures(existing);

      rewriteFilePaths(extracted, base);

      return extracted;
    } catch (error) {
      console.warn('[ember-storybook] Signature extraction failed:', error);

      return {};
    }
  };
}

export async function runTypeDoc(entryPoints: string[]): Promise<ComponentSignatureMap> {
  // Only keep entry points that exist on disk. TypeDoc throws on a missing path,
  // and because extraction runs for the whole batch, one bogus path would leave
  // *every* story without signatures (silently dropping all Controls/docs).
  const existing = entryPoints.filter((entryPoint) => existsSync(entryPoint));

  if (existing.length === 0) {
    return {};
  }

  const base = resolveTsconfigBase();

  if (!base) {
    return {};
  }

  try {
    // Component signatures, keyed by absolute entry-point paths.
    // One shared TS program resolves all files (and their transitive types).
    const extracted = await parseSignatures(existing, {
      tsconfigFile: path.join(base, 'tsconfig.json')
    });

    rewriteFilePaths(extracted, base);

    return extracted;
  } catch (error) {
    console.warn('[ember-storybook] TypeDoc extraction failed:', error);

    return {};
  }
}

type ComponentSignatures = Record<string, ComponentSignature>;

/** Extracted signatures keyed by absolute path; extraction keys them by the tsconfig's directory. */
export function byAbsolutePath(extracted: ComponentSignatureMap): Map<string, ComponentSignatures> {
  const base = resolveTsconfigBase() ?? process.cwd();

  return new Map(Object.entries(extracted).map(([file, sigs]) => [path.resolve(base, file), sigs]));
}

/**
 * Extracts the component files asked for in the same turn of the event loop
 * together, and gives each caller the whole batch's signatures. `storybook
 * build` asks for every component at once, and a program per component (each
 * with its own type checker) would take minutes.
 */
export function batched(
  extract: SignatureExtractor
): (componentFile: string) => Promise<Map<string, ComponentSignatures>> {
  let batch: undefined | { files: Set<string>; done: Promise<Map<string, ComponentSignatures>> };

  return (componentFile) => {
    if (!batch) {
      const files = new Set<string>();

      batch = {
        files,
        done: new Promise((resolve, reject) => {
          setImmediate(() => {
            batch = undefined;

            try {
              resolve(byAbsolutePath(extract([...files])));
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          });
        })
      };
    }

    batch.files.add(componentFile);

    return batch.done;
  };
}

/**
 * What the docs read for a component: its file's signatures and those of the
 * files its blocks yield components from, keyed as the docs data keys files.
 */
export function signaturesFor(
  componentFile: string,
  extracted: Map<string, ComponentSignatures>
): Record<string, ComponentSignatures> {
  const result: Record<string, ComponentSignatures> = {};
  const queue = [componentFile];

  for (let file = queue.shift(); file; file = queue.shift()) {
    const key = normalizeFilePath(file);
    const signatures = extracted.get(file);

    if (Object.hasOwn(result, key) || !signatures) continue;

    result[key] = signatures;

    for (const signature of Object.values(signatures)) {
      for (const block of Object.values(signature.blocks)) {
        for (const param of unwrapBlockParams(block.params)) {
          if (param.componentRef?.filePath) {
            queue.push(path.resolve(PROJECT_ROOT, param.componentRef.filePath));
          }
        }
      }
    }
  }

  return result;
}
