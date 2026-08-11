import { unwrapBlockParams } from './block-params';

import type { ComponentFile, EmberMeta } from '../../node/types';
import type { BlockInfo, ComponentSignature } from 'ember-docgen';

export interface SubcomponentRef {
  name: string;
  signature?: ComponentSignature;
  importPath?: string;
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

      if (seen.has(param.name)) {
        // eslint-disable-next-line unicorn/no-break-in-nested-loop
        continue;
      }

      seen.add(param.name);

      if (importPath) {
        result.push({ name: param.name, importPath });
      } else if (filePath && Object.hasOwn(data, filePath)) {
        const entry = data[filePath] as ComponentFile;

        if (Object.hasOwn(entry.signatures, exportName)) {
          const sig = entry.signatures[exportName];

          result.push({
            name: param.name,
            signature: applyModifiers(sig, modifiers)
          });
        }
      }
    }
  }

  return result;
}
