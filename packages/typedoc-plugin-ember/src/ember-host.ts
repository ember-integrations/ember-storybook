import { readFileSync } from 'node:fs';

import { Preprocessor } from 'content-tag';

import type ts from 'typescript';

const pp = new Preprocessor();

const GTS_EXT = /\.gts$/;
const GJS_EXT = /\.gjs$/;
const GTS_TS_EXT = /\.gts\.ts$/;
const GJS_TS_EXT = /\.gjs\.ts$/;

export function isEmberTSTemplate(fileName: string) {
  return GTS_EXT.test(fileName);
}

export function isEmberJSTemplate(fileName: string) {
  return GJS_EXT.test(fileName);
}

export function isEmberTemplate(fileName: string) {
  return isEmberTSTemplate(fileName) || isEmberJSTemplate(fileName);
}

export function isEmberTSTemplateWithAppendix(fileName: string) {
  return GTS_TS_EXT.test(fileName);
}

export function isEmberJSTemplateWithAppendix(fileName: string) {
  return GJS_TS_EXT.test(fileName);
}

export function isEmberTemplateWithAppendix(fileName: string) {
  return isEmberTSTemplateWithAppendix(fileName) || isEmberJSTemplateWithAppendix(fileName);
}

export function originalPath(virtualName: string) {
  return virtualName.replace(/\.(gts|gjs)\.ts$/, '.$1');
}

export function virtualPath(original: string) {
  return original + '.ts';
}

export function processEmberTemplate(fileName: string) {
  const raw = readFileSync(fileName, 'utf8');
  return pp.process(raw, { filename: fileName }).code;
}

/**
 * Wraps a TypeScript CompilerHost to handle .gts/.gjs files:
 *
 * - Virtual root names: `.gts` → `.gts.ts` so TypeScript includes them
 * - `getSourceFile`: preprocesses via content-tag, returns valid TS
 * - `fileExists`: recognizes both original and virtual paths
 * - `readFile`: serves preprocessed content for virtual paths
 */
export function createEmberHost(host: ts.CompilerHost, _ts: typeof ts): ts.CompilerHost {
  const gtsContentCache = new Map<string, string>();

  function preprocess(fileName: string): string {
    let cached = gtsContentCache.get(fileName);
    if (cached === undefined) {
      cached = processEmberTemplate(fileName);
      gtsContentCache.set(fileName, cached);
    }
    return cached;
  }

  return new Proxy(host, {
    get(target, prop, receiver) {
      // getSourceFile intercept: preprocess .gts/.gjs files
      if (prop === 'getSourceFile') {
        return (
          fileName: string,
          languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
          onError?: (message: string) => void,
          shouldCreateNewSourceFile?: boolean
        ) => {
          // Handle virtual .gts.ts files
          if (isEmberTemplateWithAppendix(fileName)) {
            const orig = originalPath(fileName);
            const code = preprocess(orig);
            const languageVersion =
              typeof languageVersionOrOptions === 'number'
                ? languageVersionOrOptions
                : languageVersionOrOptions.languageVersion;
            return _ts.createSourceFile(fileName, code, languageVersion);
          }

          // Handle direct .gts/.gjs files (for module resolution of imports)
          if (isEmberTemplate(fileName)) {
            const code = preprocess(fileName);
            const languageVersion =
              typeof languageVersionOrOptions === 'number'
                ? languageVersionOrOptions
                : languageVersionOrOptions.languageVersion;
            return _ts.createSourceFile(fileName, code, languageVersion);
          }

          return target.getSourceFile!(
            fileName,
            languageVersionOrOptions as ts.ScriptTarget,
            onError,
            shouldCreateNewSourceFile
          );
        };
      }

      if (prop === 'fileExists') {
        return (fileName: string) => {
          // Virtual .gts.ts → check original
          if (isEmberTemplateWithAppendix(fileName)) {
            return target.fileExists!(originalPath(fileName));
          }
          // .gts/.gjs files exist
          if (isEmberTemplate(fileName)) {
            return target.fileExists!(fileName);
          }
          return target.fileExists!(fileName);
        };
      }

      // readFile: serve preprocessed content for virtual/module resolution
      if (prop === 'readFile') {
        return (fileName: string) => {
          if (isEmberTemplateWithAppendix(fileName)) {
            return preprocess(originalPath(fileName));
          }
          if (isEmberTemplate(fileName)) {
            return preprocess(fileName);
          }
          return target.readFile!(fileName);
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Maps root names so .gts/.gjs files are renamed to .gts.ts/.gjs.ts
 * so TypeScript includes them (it only processes .ts/.tsx/.js/.jsx).
 * Returns the new list + a reverse-map for the caller.
 */
export function mapRootNames(
  rootNames: readonly string[]
): [string[], Map<string, string>] {
  const reverseMap = new Map<string, string>();

  const mapped = Array.from(rootNames).map((name) => {
    if (isEmberTSTemplate(name)) {
      const v = virtualPath(name);
      reverseMap.set(v, name);
      return v;
    }
    if (isEmberJSTemplate(name)) {
      const v = virtualPath(name);
      reverseMap.set(v, name);
      return v;
    }
    return name;
  });

  return [mapped, reverseMap];
}
