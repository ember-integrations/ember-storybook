import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  createEmberHost,
  isEmberTemplateWithAppendix,
  originalPath,
  virtualPath
} from 'typedoc-plugin-ember';

import type TS from 'typescript';

/**
 * Resolve relative imports to sibling `.gts`/`.gjs` files, which the
 * TypeScript resolver does not know about. Returns the virtual path of
 * the imported template.
 */
function resolveEmberTemplateImport(
  moduleName: string,
  containingFile: string
): string | undefined {
  if (!moduleName.startsWith('.')) return undefined;

  const containerDir = path.dirname(
    isEmberTemplateWithAppendix(containingFile) ? originalPath(containingFile) : containingFile
  );
  const base = path.resolve(containerDir, moduleName);

  for (const ext of ['.gts', '.gjs'] as const) {
    const candidate = base.endsWith(ext) ? base : base + ext;

    if (candidate.endsWith(ext) && existsSync(candidate)) {
      return virtualPath(candidate);
    }
  }

  return undefined;
}

/**
 * An Ember-aware compiler host owned by docgen: layers `.gts`/`.gjs`
 * module resolution on top of {@link createEmberHost}, so cross-file
 * imports between Ember templates resolve inside programs built here.
 */
export function createDocgenHost(host: TS.CompilerHost, ts: typeof TS): TS.CompilerHost {
  const emberHost = createEmberHost(host, ts);

  return new Proxy(emberHost, {
    get(target, prop, receiver) {
      // Module resolution: TypeScript does not know about .gts/.gjs
      // extensions, so resolve them ourselves before falling back to the
      // standard resolver.
      if (prop === 'resolveModuleNames') {
        return (
          moduleNames: readonly string[],
          containingFile: string,
          reusedNames?: string[],
          redirectedReference?: TS.ScriptTarget,
          options?: TS.CompilerOptions
        ) =>
          moduleNames.map((moduleName) => {
            const templateImport = resolveEmberTemplateImport(moduleName, containingFile);

            if (templateImport) {
              return {
                resolvedFileName: templateImport,
                extension: templateImport.endsWith('.gjs.ts') ? ts.Extension.Js : ts.Extension.Ts,
                isExternalLibraryImport: false
              };
            }

            return ts.resolveModuleName(
              moduleName,
              containingFile,
              options ?? {},
              {
                fileExists: (fileName) => target.fileExists!(fileName),
                readFile: (fileName) => target.readFile?.(fileName),
                directoryExists: (directoryName) =>
                  target.directoryExists?.(directoryName) ?? false,
                getDirectories: (directoryName) => target.getDirectories?.(directoryName) ?? []
              }
            ).resolvedModule;
          });
      }

      return Reflect.get(target, prop, receiver);
    }
  });
}
