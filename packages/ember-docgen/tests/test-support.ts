import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Minimal declaration shims so test fixtures can import the *real* module
 * specifiers (`@ember/component/template-only`, `@glimmer/component`,
 * `@glint/template`) while staying hermetic. Spread into any tempFixture.
 */
export const NODE_MODULES_SHIMS: Record<string, string> = {
  'node_modules/@ember/component/template-only/package.json':
    '{ "name": "@ember/component/template-only", "types": "index.d.ts" }',
  'node_modules/@ember/component/template-only/index.d.ts': `
export interface TOC<S> {
  [K in keyof S]: S[K];
}
export interface TemplateOnlyComponent<S> {
  [K in keyof S]: S[K];
}
`.trim(),
  'node_modules/@glimmer/component/package.json':
    '{ "name": "@glimmer/component", "types": "index.d.ts" }',
  'node_modules/@glimmer/component/index.d.ts': `
export default class Component<S> {
  readonly args: S extends { Args: infer A } ? A : unknown;
}
`.trim(),
  'node_modules/@glint/template/package.json':
    '{ "name": "@glint/template", "types": "index.d.ts" }',
  'node_modules/@glint/template/index.d.ts': `
export interface WithBoundArgs<T, K extends string> {}
export interface ComponentLike<S> {}
export interface Invokable<S> {}
`.trim()
};

export function tempFixture(files: Record<string, string>) {
  const allFiles = { ...NODE_MODULES_SHIMS, ...files };
  const base = mkdtempSync(path.join(tmpdir(), 'ember-storybook-test-'));

  for (const [rel, content] of Object.entries(allFiles)) {
    const abs = path.join(base, rel);

    mkdirSync(path.join(abs, '..'), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  }

  return {
    base,
    [Symbol.dispose](): void {
      rmSync(base, { recursive: true, force: true });
    }
  };
}
