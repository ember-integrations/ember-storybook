import { unwrapBlockParams } from './block-params';

import type { ComponentMap } from '../../node/parser';
import type { ComponentFile, EmberMeta } from '../../node/types';
import type { BlockInfo, BlockParam, ComponentSignature } from 'ember-docgen';

/**
 * Key used for default exports in signature/component maps. Mirrors
 * ember-docgen's `Default` sentinel — duplicated as a literal so client
 * code does not pull ember-docgen's node-only dependencies into the bundle.
 */
export const DEFAULT_EXPORT = '__DEFAULT__';

export interface SubcomponentRef {
  name: string;
  signature?: ComponentSignature;
  importPath?: string;
}

/**
 * Resolve the human-facing name of a referenced component export.
 *
 * Prefers the component's own declaration name over its export alias and
 * resolves the default-export sentinel to the real class name via the
 * component file's declaration map. Returns `undefined` when no better
 * name is known.
 */
function hasSignatureMap(entry: unknown): entry is ComponentFile {
  return typeof entry === 'object' && entry !== null && Object.hasOwn(entry, 'signatures');
}

export function componentDisplayName(
  ref: undefined | { filePath?: string; exportName?: string },
  data: EmberMeta
): string | undefined {
  if (!ref?.filePath || !ref.exportName) return undefined;

  const rawEntry: unknown = data[ref.filePath];

  const componentEntry = hasSignatureMap(rawEntry) ? rawEntry : undefined;

  if (!componentEntry) {
    return ref.exportName === DEFAULT_EXPORT ? undefined : ref.exportName;
  }

  // Transitive component files contribute only `signatures` (no declaration
  // map) — fall back to the name the docgen records for a default export, and
  // to the export name otherwise.
  const meta = (componentEntry as { meta?: ComponentMap }).meta;

  if (ref.exportName === DEFAULT_EXPORT) {
    const declaredName = Object.hasOwn(componentEntry.signatures, DEFAULT_EXPORT)
      ? componentEntry.signatures[DEFAULT_EXPORT].name
      : undefined;

    return meta?.[DEFAULT_EXPORT] ?? declaredName;
  }

  return meta?.[ref.exportName] ?? ref.exportName;
}

export function applyModifiers(
  signature: ComponentSignature,
  modifiers?: { name: string; typeArgs: string[] }[]
): ComponentSignature {
  if (!modifiers || modifiers.length === 0) return signature;

  const blockedKeys = new Set<string>();
  const pickedKeys = new Set<string>();

  for (const mod of modifiers) {
    if (mod.name === 'WithBoundArgs' || mod.name === 'Omit') {
      for (const key of mod.typeArgs) blockedKeys.add(key);
    }

    if (mod.name === 'Pick') {
      for (const key of mod.typeArgs) pickedKeys.add(key);
    }
  }

  const filtered =
    pickedKeys.size > 0
      ? Object.fromEntries(Object.entries(signature.args).filter(([k]) => pickedKeys.has(k)))
      : Object.fromEntries(Object.entries(signature.args).filter(([k]) => !blockedKeys.has(k)));

  return { ...signature, args: filtered };
}

/**
 * The name a yielded component goes by in the docs page's Subcomponents and
 * Blocks table: its own name, else its yield key. Local components (not
 * exported) are named by the yield key — the declaration name is an
 * implementation detail.
 */
export function subcomponentName(param: BlockParam, data: EmberMeta): string {
  return param.componentRef?.local
    ? param.name
    : (componentDisplayName(param.componentRef, data) ?? param.name);
}

export function collectSubcomponents(
  blocks: Record<string, BlockInfo>,
  data: EmberMeta
): SubcomponentRef[] {
  const seen = new Set<string>();

  const result: SubcomponentRef[] = [];

  for (const block of Object.values(blocks)) {
    for (const param of unwrapBlockParams(block.params)) {
      if (!param.componentRef) {
        // eslint-disable-next-line unicorn/no-break-in-nested-loop
        continue;
      }

      const { filePath, exportName, importPath, modifiers } = param.componentRef;
      const name = subcomponentName(param, data);

      if (seen.has(name)) {
        // eslint-disable-next-line unicorn/no-break-in-nested-loop
        continue;
      }

      seen.add(name);

      if (importPath) {
        result.push({ name, importPath });
      } else if (filePath && Object.hasOwn(data, filePath)) {
        const entry = data[filePath] as ComponentFile;

        if (Object.hasOwn(entry.signatures, exportName)) {
          const sig = entry.signatures[exportName];

          result.push({
            name,
            signature: applyModifiers(sig, modifiers)
          });
        }
      } else if (filePath) {
        // Project-local file without an extractable signature
        // (e.g. a bare template-only component) — still list it by name.
        result.push({ name });
      }
    }
  }

  return result;
}
