import { createRequire } from 'node:module';
import path from 'node:path';

import { Application, type DocumentationEntryPoint } from 'typedoc';
import { createEmberHost } from 'typedoc-plugin-ember';

import { extractSignatures } from './signature-extractor';

import type { ComponentSignatureMap } from './types';
// eslint-disable-next-line import-x/default
import type TS from 'typescript';

export interface TypeDocOptions {
  entryPoints: string[];
  tsconfig?: string;
}

const require = createRequire(import.meta.url);
const ts = require('typescript') as typeof TS;

export async function runTypeDoc(options: TypeDocOptions): Promise<ComponentSignatureMap> {
  if (options.entryPoints.length === 0) {
    return {};
  }

  try {
    const app = await Application.bootstrapWithPlugins({
      entryPoints: [],
      tsconfig: options.tsconfig,
      skipErrorChecking: true,
      excludePrivate: false,
      excludeProtected: false
    });

    const compilerOptions = app.options.getCompilerOptions(app.logger);
    const baseHost = ts.createCompilerHost(compilerOptions);
    const host = createEmberHost(baseHost, ts);

    const rootNames = options.entryPoints.map((ep) =>
      ep.endsWith('.gts') || ep.endsWith('.gjs') ? ep + '.ts' : ep
    );

    const program = ts.createProgram({
      rootNames,
      options: compilerOptions,
      host
    });

    const entryPoints = options.entryPoints
      .map((ep, i) => {
        const rn = rootNames[i];
        const sf = program.getSourceFile(rn);

        // eslint-disable-next-line unicorn/no-null
        if (!sf) return null;

        return {
          displayName: path.basename(ep, path.extname(ep)),
          sourceFile: sf,
          program
        };
      })
      .filter(Boolean) as DocumentationEntryPoint[];

    if (entryPoints.length === 0) {
      return {};
    }

    await app.initializeRepositories(entryPoints);

    const project = app.converter.convert(entryPoints);

    const projectRoot = process.cwd();
    const json = app.serializer.projectToObject(project, projectRoot as never);

    const extracted = extractSignatures(json as never, projectRoot);
    const mapped: ComponentSignatureMap = {};

    for (const [relPath, compSigs] of Object.entries(extracted)) {
      const cleanRel = relPath.replace(/\.(gts|gjs)\.ts$/, '.$1');
      const match = options.entryPoints.find((ep) => ep.endsWith(cleanRel));

      if (match) {
        mapped[match] = { ...mapped[match], ...compSigs };
      }
    }

    return mapped;
  } catch (error) {
    console.warn('[ember-storybook] TypeDoc extraction failed:', error);

    return {};
  }
}
