import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { extractStoryMeta } from './parser';

/*
 * Helper: create a temp directory with the given fixture files (relative
 * path → content) and return { base, cleanup }.
 */
function tempFixture(files: Record<string, string>) {
  const base = mkdtempSync(path.join(tmpdir(), 'ember-storybook-test-'));

  for (const [rel, content] of Object.entries(files)) {
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

describe('extractStoryMeta', () => {
  test('extracts inline template for a story with render()', async () => {
    const source = `
import { Greeting } from './greeting.gts';
export default { component: Greeting } satisfies Meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim();
    const storyIds = new Map([['LTR', 'test--ltr']]);
    const meta = await extractStoryMeta(source, 'test.stories.gts', storyIds);

    expect(Object.keys(meta)).toEqual(['test--ltr']);
    expect(meta['test--ltr'].inlineTemplate).toBe('<Greeting @name={{args.name}} />');
    expect(meta['test--ltr'].componentName).toBe('Greeting');
  });

  test('resolves component name from deferred meta variable', async () => {
    const source = `
import { Greeting } from './greeting.gts';
const meta = { component: Greeting } satisfies Meta;
export default meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim();
    const storyIds = new Map([['LTR', 'test--ltr']]);
    const meta = await extractStoryMeta(source, 'test.stories.gts', storyIds);

    expect(meta['test--ltr'].componentName).toBe('Greeting');
    expect(meta['test--ltr'].inlineTemplate).toBe('<Greeting @name={{args.name}} />');
  });

  test('resolves component from inline default export', async () => {
    const source = `
import { Greeting } from './greeting.gts';
export default { component: Greeting, title: 'Test' } satisfies Meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim();
    const storyIds = new Map([['LTR', 'test--ltr']]);
    const meta = await extractStoryMeta(source, 'test.stories.gts', storyIds);

    expect(meta['test--ltr'].componentName).toBe('Greeting');
  });

  test('handles stories without inline template', async () => {
    const source = `
import { Greeting } from './greeting.gts';
export default { component: Greeting } satisfies Meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
export const Plain: StoryObj = {
  render: (args) => args
};
`.trim();
    const storyIds = new Map([
      ['LTR', 'test--ltr'],
      ['Plain', 'test--plain']
    ]);
    const meta = await extractStoryMeta(source, 'test.stories.gts', storyIds);

    expect(meta['test--ltr'].inlineTemplate).toBe('<Greeting @name={{args.name}} />');
    expect(meta['test--plain'].inlineTemplate).toBeUndefined();
  });

  test('handles multiple inline templates', async () => {
    const source = `
export const A: StoryObj = {
  render: (args) => <template><X @a={{args.a}} /></template>
};
export const B: StoryObj = {
  render: (args) => <template><Y>{{args.b}}</template>
};
`.trim();
    const storyIds = new Map([
      ['A', 'test--a'],
      ['B', 'test--b']
    ]);
    const meta = await extractStoryMeta(source, 'test.stories.gts', storyIds);

    expect(meta['test--a'].inlineTemplate).toBe('<X @a={{args.a}} />');
    expect(meta['test--b'].inlineTemplate).toBe('<Y>{{args.b}}');
  });

  test('strips TS type assertions from the default export', async () => {
    const source = `
import { Button } from './button.gts';
export default { component: Button, title: 'Test' } satisfies Meta;
export const Primary: StoryObj = {
  render: (args) => <template><Button /></template>
};
`.trim();
    const storyIds = new Map([['Primary', 'test--primary']]);
    const meta = await extractStoryMeta(source, 'test.stories.gts', storyIds);

    expect(meta['test--primary'].componentName).toBe('Button');
  });

  test('resolves component name from an actual component file', async () => {
    using fix = tempFixture({
      'greeting.gts': `export const Greeting = <template><div>Hello</div></template>;`
    });

    const source = `
import { Greeting } from './greeting.gts';
export default { component: Greeting } satisfies Meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim();
    const storyIds = new Map([['LTR', 'test--ltr']]);
    const meta = await extractStoryMeta(source, path.join(fix.base, 'test.stories.gts'), storyIds);

    expect(meta['test--ltr'].componentName).toBe('Greeting');
  });

  test('resolves component name from an export-specifier component file', async () => {
    using fix = tempFixture({
      'greeting.gts': `const G = <template><div>Hello</div></template>;\nexport { G as Greeting };`
    });

    const source = `
import { Greeting } from './greeting.gts';
export default { component: Greeting } satisfies Meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim();
    const storyIds = new Map([['LTR', 'test--ltr']]);
    const meta = await extractStoryMeta(source, path.join(fix.base, 'test.stories.gts'), storyIds);

    expect(meta['test--ltr'].componentName).toBe('Greeting');
  });

  test('resolves component name from a default export in component file', async () => {
    using fix = tempFixture({
      'greeting.gts': `import Component from '@glimmer/component';\nexport default class Greeting extends Component<Signature> {}`
    });

    const source = `
import { Greeting } from './greeting.gts';
export default { component: Greeting } satisfies Meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim();
    const storyIds = new Map([['LTR', 'test--ltr']]);
    const meta = await extractStoryMeta(source, path.join(fix.base, 'test.stories.gts'), storyIds);

    expect(meta['test--ltr'].componentName).toBe('Greeting');
  });

  test('skips non-template call expressions', async () => {
    const source = `
export const Story: StoryObj = {
  render: (args) => <template><X /></template>
};
console.log(template_xxx(\`ignored\`));
`.trim();
    const storyIds = new Map([['Story', 'test--story']]);
    const meta = await extractStoryMeta(source, 'test.stories.gts', storyIds);

    expect(meta['test--story'].inlineTemplate).toBe('<X />');
  });

  test('falls back to import identifier when component file is missing', async () => {
    const source = `
import { Missing } from './does-not-exist.gts';
export default { component: Missing } satisfies Meta;
export const Story: StoryObj = {
  render: (args) => <template><Missing /></template>
};
`.trim();
    const storyIds = new Map([['Story', 'test--story']]);
    const meta = await extractStoryMeta(source, 'test.stories.gts', storyIds);

    expect(meta['test--story'].componentName).toBe('Missing');
    expect(meta['test--story'].inlineTemplate).toBe('<Missing />');
  });

  test('parses pure-JS .gjs files without type annotations', async () => {
    const source = `
import { Greeting } from './greeting.gts';
export default { component: Greeting };
export const LTR = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim();
    const storyIds = new Map([['LTR', 'test--ltr']]);
    const meta = await extractStoryMeta(source, 'test.stories.gjs', storyIds);

    expect(meta['test--ltr'].componentName).toBe('Greeting');
    expect(meta['test--ltr'].inlineTemplate).toBe('<Greeting @name={{args.name}} />');
  });

  test('rejects TS syntax in .gjs files using JS parser', async () => {
    const source = `
import { Button } from './button.gts';
export default { component: Button } satisfies Meta;
export const Primary: StoryObj = {
  render: (args) => <template><Button /></template>
};
`.trim();
    const storyIds = new Map([['Primary', 'test--primary']]);
    const meta = await extractStoryMeta(source, 'test.stories.gjs', storyIds);

    // JS parser rejects "satisfies" and type annotations → empty program
    // componentName defaults to '' and no inline template is found
    expect(meta['test--primary'].componentName).toBe('');
    expect(meta['test--primary'].inlineTemplate).toBeUndefined();
  });
});
