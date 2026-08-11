import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { tempFixture } from './test-support';

import { analyze, parseFile, parseProject } from '../src';

describe('parse', () => {
  test('parseFile + analyze extracts signature from a plain .ts file', async () => {
    using fix = tempFixture({
      'tsconfig.json': `
{
  "compilerOptions": {
    "strict": true,
    "target": "esnext",
    "module": "esnext",
    "moduleResolution": "bundler",
    "skipLibCheck": true
  },
  "include": ["app/**/*"]
}
`.trim(),
      'app/button.ts': `
export interface Signature {
  Args: {
    label: string;
  };
}

export const Button = {} as unknown as import('./types').TOC<Signature>;
`.trim(),
      'app/types.ts': `
export type TOC<T> = {
  [K in keyof T]: T[K];
} & ((args: T extends { Args: infer A } ? A : never) => unknown);
`.trim()
    });

    const file = path.join(fix.base, 'app/button.ts');

    const json = await parseFile(file, { tsconfigFile: path.join(fix.base, 'tsconfig.json') });
    const sigs = analyze(json, { tsconfigFile: path.join(fix.base, 'tsconfig.json') });

    const key = 'app/button.ts';
    expect(sigs[key]).toHaveProperty('Button');
    expect(sigs[key].Button.args).toHaveProperty('label');
    expect(sigs[key].Button.args.label.required).toBe(true);
  });

  test('parseProject uses tsconfig include when no typedoc entry points', async () => {
    using fix = tempFixture({
      'tsconfig.json': `
{
  "compilerOptions": {
    "strict": true,
    "target": "esnext",
    "module": "esnext",
    "moduleResolution": "bundler",
    "skipLibCheck": true
  },
  "include": ["app/**/*"]
}
`.trim(),
      'app/button.ts': `
export interface Signature {
  Args: {
    label: string;
  };
}

export const Button = {} as unknown as import('./types').TOC<Signature>;
`.trim(),
      'app/types.ts': `
export type TOC<T> = {
  [K in keyof T]: T[K];
} & ((args: T extends { Args: infer A } ? A : never) => unknown);
`.trim()
    });

    const opts = { tsconfigFile: path.join(fix.base, 'tsconfig.json') };

    const json = await parseProject(opts);
    const sigs = analyze(json, opts);

    expect(sigs['app/button.ts']).toHaveProperty('Button');
  });
});
