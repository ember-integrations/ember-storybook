import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

// eslint-disable-next-line import-x/default
import type TS from 'typescript';

const require = createRequire(import.meta.url);
const ts = require('typescript') as typeof TS;

import type { DocgenOptions } from './signature';

/**
 * Resolve the tsconfig file, replicating TypeDoc's discovery:
 * explicit `tsconfigFile` when given, else walk up from cwd.
 * Returns undefined when no tsconfig can be found.
 */
export function resolveTsconfigFile(opts?: DocgenOptions): string | undefined {
  if (opts?.tsconfigFile) {
    return resolve(opts.tsconfigFile);
  }

  return ts.findConfigFile(process.cwd(), ts.sys.fileExists) ?? undefined;
}

/**
 * The path anchor shared by parse and analyze.
 *
 * parse pins TypeDoc's displayBasePath to this directory so JSON
 * sources are relative to it; analyze re-derives it from the same opts.
 */
export function resolveTsconfigBase(opts?: DocgenOptions): string | undefined {
  const file = resolveTsconfigFile(opts);

  return file ? dirname(file) : undefined;
}
