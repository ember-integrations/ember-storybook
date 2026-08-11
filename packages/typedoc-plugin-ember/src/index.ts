import { basename, extname } from 'node:path';
import { createRequire } from 'node:module';

import { Preprocessor } from 'content-tag';
import type { Application, DocumentationEntryPoint } from 'typedoc';

export { createEmberHost, mapRootNames, processEmberTemplate, isEmberTemplate, isEmberTemplateWithAppendix, originalPath, virtualPath } from './ember-host';

import { createEmberHost, isEmberTemplate, isEmberTemplateWithAppendix, originalPath, virtualPath } from './ember-host';

const require = createRequire(import.meta.url);

let patched = false;

export function load(app: Application) {
  if (!patched) {
    patched = true;
    patchSys();
  }

  // Override convert() to handle .gts/.gjs entry points via a manually
  // created TypeScript program, bypassing TypeDoc's expandGlobs (which
  // requires all files to exist on disk).
  const origConvert = app.convert.bind(app);
  app.convert = async () => {
    const entryPoints: string[] = app.options.getValue('entryPoints');
    const hasEmber = entryPoints.some(isEmberTemplate);

    if (!entryPoints.length || !hasEmber) {
      return origConvert();
    }

    const _ts = require('typescript') as typeof import('typescript');
    const compilerOptions = app.options.getCompilerOptions(app.logger);
    const host = createEmberHost(_ts.createCompilerHost(compilerOptions), _ts);

    const rootNames = entryPoints.map((ep) =>
      isEmberTemplate(ep) ? virtualPath(ep) : ep,
    );

    const program = _ts.createProgram({
      rootNames,
      options: compilerOptions,
      host,
    });

    const manual: DocumentationEntryPoint[] = entryPoints
      .map((ep, i) => {
        const sf = program.getSourceFile(rootNames[i]);
        if (!sf) return null;
        return {
          displayName: basename(ep, extname(ep)),
          sourceFile: sf,
          program,
        };
      })
      .filter((x): x is DocumentationEntryPoint => x !== null);

    if (!manual.length) {
      app.logger.error('No entry points could be resolved');
      return;
    }

    await app.initializeRepositories(manual);
    return app.converter.convert(manual);
  };
}

function patchSys() {
  let _ts: typeof import('typescript');

  try {
    _ts = require('typescript');
  } catch {
    return;
  }

  const pp = new Preprocessor();

  // Make ts.sys recognize virtual .gts.ts files by mapping file existence
  // and content reads to the real .gts/.gjs files on disk.
  const origFileExists = _ts.sys.fileExists.bind(_ts.sys);
  _ts.sys.fileExists = (path: string) => {
    if (isEmberTemplateWithAppendix(path)) {
      return origFileExists(originalPath(path));
    }
    return origFileExists(path);
  };

  const origReadFile = _ts.sys.readFile.bind(_ts.sys);
  _ts.sys.readFile = (path: string, encoding?: string) => {
    if (isEmberTemplateWithAppendix(path)) {
      const realPath = originalPath(path);
      const raw = origReadFile(realPath, encoding);
      if (raw != null) {
        return pp.process(raw, { filename: realPath }).code;
      }
      return raw;
    }
    return origReadFile(path, encoding);
  };
}
