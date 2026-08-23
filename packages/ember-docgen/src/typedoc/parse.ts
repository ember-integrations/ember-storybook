import { createRequire } from 'node:module';
import { basename, extname } from 'node:path';

import { glob } from 'tinyglobby';
import { Application, type DocumentationEntryPoint, type ProjectReflection } from 'typedoc';
import { createDocgenHost } from '../ember-host';

import { resolveTsconfigBase, resolveTsconfigFile } from '../config';

import type { DocgenOptions } from '../signature';
import type { JSONOutput, TypeDocOptions } from 'typedoc';

const require = createRequire(import.meta.url);
// eslint-disable-next-line import-x/default
import type TS from 'typescript';

const ts = require('typescript') as typeof TS;

function isEmberTemplate(filePath: string): boolean {
  return filePath.endsWith('.gts') || filePath.endsWith('.gjs');
}

function bootstrapOptions(
  opts: DocgenOptions | undefined,
  overrides: Partial<TypeDocOptions>
): Partial<TypeDocOptions> {
  const baseDir = resolveTsconfigBase(opts);

  return {
    ...opts?.typedocConfig,
    ...(opts?.typedocConfigFile ? { options: opts.typedocConfigFile } : {}),
    tsconfig: resolveTsconfigFile(opts),
    ...(baseDir ? { displayBasePath: baseDir } : {}),
    skipErrorChecking: true,
    excludePrivate: false,
    excludeProtected: false,
    ...overrides
  };
}

/**
 * Shared pipeline: build the ember-aware TypeScript program and convert it.
 *
 * This is the manual .gts translation (createDocgenHost + virtual .gts.ts
 * root names), not typedoc-plugin-ember's load() hook — that hook is broken
 * for glob-based entry points.
 */
async function runConversion(
  app: Application,
  files: string[]
): Promise<ProjectReflection> {
  const compilerOptions = app.options.getCompilerOptions(app.logger);
  const host = createDocgenHost(ts.createCompilerHost(compilerOptions), ts);

  const rootNames = files.map((file) => (isEmberTemplate(file) ? file + '.ts' : file));

  const program = ts.createProgram({
    rootNames,
    options: compilerOptions,
    host
  });

  const entryPoints = files
    .map((file, i) => {
      const rootName = rootNames[i];
      const sourceFile = program.getSourceFile(rootName);

      // eslint-disable-next-line unicorn/no-null
      if (!sourceFile) return null;

      return {
        displayName: basename(file, extname(file)),
        sourceFile,
        program
      };
    })
    .filter(Boolean) as DocumentationEntryPoint[];

  if (entryPoints.length === 0) {
    throw new Error('No entry points could be resolved');
  }

  await app.initializeRepositories(entryPoints);

  return app.converter.convert(entryPoints);
}

function resolveEntryPoints(
  app: Application,
  tsconfigFile: string | undefined
): string[] {
  const configured = app.options.getValue('entryPoints') as string[];

  if (configured.length > 0) {
    return configured;
  }

  if (!tsconfigFile) return [];

  // Fall back to tsconfig include/files
  const parsed = ts.getParsedCommandLineOfConfigFile(
    tsconfigFile,
    {},
    ts.sys as never
  );

  return parsed?.fileNames ?? [];
}

async function expandEntryPoints(entryPoints: string[]): Promise<string[]> {
  const files = await glob(entryPoints, {
    cwd: process.cwd(),
    absolute: true,
    expandDirectories: false
  });

  return files;
}

/**
 * Run typedoc on a single file and return the typedoc project JSON.
 */
export async function parseTypedocFile(
  file: string,
  opts?: DocgenOptions
): Promise<JSONOutput.ProjectReflection> {
  const baseDir = resolveTsconfigBase(opts);

  const app = await Application.bootstrapWithPlugins(
    bootstrapOptions(opts, { entryPoints: [file] })
  );

  const project = await runConversion(app, [file]);

  return app.serializer.projectToObject(project, baseDir as never);
}

/**
 * Run typedoc on the project's entry points (from typedoc config,
 * falling back to tsconfig include/files) and return the JSON.
 */
export async function parseTypedocProject(
  opts?: DocgenOptions
): Promise<JSONOutput.ProjectReflection> {
  const baseDir = resolveTsconfigBase(opts);

  const app = await Application.bootstrapWithPlugins(bootstrapOptions(opts, {}));

  const entryPoints = resolveEntryPoints(app, resolveTsconfigFile(opts));
  const files = await expandEntryPoints(entryPoints);

  if (files.length === 0) {
    throw new Error('No entry points could be resolved');
  }

  const project = await runConversion(app, files);

  return app.serializer.projectToObject(project, baseDir as never);
}
