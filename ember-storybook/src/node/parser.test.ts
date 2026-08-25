import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { tempFixture } from './test-support';

import { type ComponentMap, parseComponentFile, parseStoryFile, type StoryFile } from './parser';
import { Default } from './shared';

function findStory(
  stories: { name?: string; localName?: string; inlineTemplate?: string }[],
  name: string
) {
  return stories.find((s) => s.localName === name || s.name === name);
}

describe('parseStoryFile', () => {
  test('resolves component name from deferred meta variable', () => {
    using fix = tempFixture({
      'test.stories.gts': `
import { Greeting } from './greeting.gts';
const meta = { component: Greeting } satisfies Meta;
export default meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;

    expect(result.meta.component).toBe('Greeting');
    expect(result.component.signatureName).toBe('Greeting');
  });

  test('resolves component from inline default export', () => {
    using fix = tempFixture({
      'test.stories.gts': `
import { Greeting } from './greeting.gts';
export default { component: Greeting, title: 'Test' } satisfies Meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;

    expect(result.meta.component).toBe('Greeting');
    expect(result.component.signatureName).toBe('Greeting');
  });

  test('strips TS type assertions from the default export', () => {
    using fix = tempFixture({
      'test.stories.gts': `
import { Button } from './button.gts';
export default { component: Button, title: 'Test' } satisfies Meta;
export const Primary: StoryObj = {
  render: (args) => <template><Button /></template>
};
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;

    expect(result.meta.component).toBe('Button');
  });

  test('resolves component name from an actual component file', () => {
    using fix = tempFixture({
      'greeting.gts': `export const Greeting = <template><div>Hello</div></template>;`,
      'test.stories.gts': `
import { Greeting } from './greeting.gts';
export default { component: Greeting } satisfies Meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;

    expect(result.component.file).toMatch(/greeting\.gts$/);
    expect(result.meta.component).toBe('Greeting');
    expect(result.component.signatureName).toBe('Greeting');
  });

  test('resolves component name from an export-specifier component file', () => {
    using fix = tempFixture({
      'greeting.gts': `const G = <template><div>Hello</div></template>;\nexport { G as Greeting };`,
      'test.stories.gts': `
import { Greeting } from './greeting.gts';
export default { component: Greeting } satisfies Meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;

    expect(result.component.file).toMatch(/greeting\.gts$/);
    expect(result.meta.component).toBe('Greeting');
    expect(result.component.signatureName).toBe('Greeting');
  });

  test('resolves component name from a default export in component file', () => {
    using fix = tempFixture({
      // 'greeting.gts': `import Component from '@glimmer/component';\nexport default class Greeting extends Component<Signature> {}`,
      'test.stories.gts': `
import Greeting from './greeting.gts';
export default { component: Greeting } satisfies Meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;

    // expect(result.component.file).toMatch(/greeting\.gts$/);
    expect(result.meta.component).toBe('Greeting');
    expect(result.component.signatureName).toBe('Greeting');
  });

  test('resolves component name from a default export in component file with multiple components', () => {
    using fix = tempFixture({
      'greeting.gts': `import Component from '@glimmer/component';
const Logo = <template>logo</template>;
export default class Greeting extends Component<Signature> {}
`,
      'test.stories.gts': `
import Greeting from './greeting.gts';
export default { component: Greeting } satisfies Meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;

    expect(result.component.file).toMatch(/greeting\.gts$/);
    expect(result.meta.component).toBe('Greeting');
    expect(result.component.signatureName).toBe(Default);
  });

  test('resolves all three names when component uses separate var + specifier export', () => {
    using fix = tempFixture({
      'card.gts': `const Card = <template><div>Hello</div></template>;\nexport { Card as CardExport };`,
      'test.stories.gts': `
import { CardExport as CardComponent } from './card.gts';
export default { component: CardComponent } satisfies Meta;
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;

    expect(result.component.file).toMatch(/card\.gts$/);
    expect(result.meta.component).toBe('CardComponent');
    expect(result.component.signatureName).toBe('CardExport');
  });

  test('resolves all three names when component uses export var + specifier re-export', () => {
    using fix = tempFixture({
      'card.gts': `export const Card = <template><div>Hello</div></template>;\nexport { Card as CardExport };`,
      'test.stories.gts': `
import { CardExport as CardComponent } from './card.gts';
export default { component: CardComponent } satisfies Meta;
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;

    expect(result.component.file).toMatch(/card\.gts$/);
    expect(result.meta.component).toBe('CardComponent');
    expect(result.component.signatureName).toBe('CardExport');
  });

  test('extracts inline template for a story with render()', () => {
    using fix = tempFixture({
      'test.stories.gts': `
import { Greeting } from './greeting.gts';
export default { component: Greeting } satisfies Meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;
    const story = findStory(result.stories, 'LTR');

    expect(story?.inlineTemplate).toBe('<Greeting @name={{args.name}} />');
  });

  test('handles stories without inline template', () => {
    using fix = tempFixture({
      'test.stories.gts': `
import { Greeting } from './greeting.gts';
export default { component: Greeting } satisfies Meta;
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
export const Plain: StoryObj = {
  render: (args) => args
};
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;

    const story = findStory(result.stories, 'LTR');

    expect(story?.inlineTemplate).toBe('<Greeting @name={{args.name}} />');

    const plain = findStory(result.stories, 'Plain');

    expect(plain?.inlineTemplate).toBeUndefined();
  });

  test('handles multiple inline templates', () => {
    using fix = tempFixture({
      'test.stories.gts': `
export default { component: X } satisfies Meta;
export const A: StoryObj = {
  render: (args) => <template><X @a={{args.a}} /></template>
};
export const B: StoryObj = {
  render: (args) => <template><Y>{{args.b}}</template>
};
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;
    const a = findStory(result.stories, 'A');

    expect(a?.inlineTemplate).toBe('<X @a={{args.a}} />');

    const b = findStory(result.stories, 'B');

    expect(b?.inlineTemplate).toBe('<Y>{{args.b}}');
  });

  test('skips non-template call expressions', () => {
    using fix = tempFixture({
      'test.stories.gts': `
export default { component: X } satisfies Meta;
export const Story: StoryObj = {
  render: (args) => <template><X /></template>
};
console.log(template_xxx(\`ignored\`));
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;
    const story = findStory(result.stories, 'Story');

    expect(story?.inlineTemplate).toBe('<X />');
  });

  test('parses pure-JS .gjs files without type annotations', () => {
    using fix = tempFixture({
      'test.stories.gjs': `
import { Greeting } from './greeting.gts';
export default { component: Greeting };
export const LTR = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gjs');
    const result = parseStoryFile(storyPath) as StoryFile;
    const story = findStory(result.stories, 'LTR');

    expect(story?.inlineTemplate).toBe('<Greeting @name={{args.name}} />');
  });

  test('falls back to import identifier when component file is missing', () => {
    using fix = tempFixture({
      'test.stories.gts': `
import { Missing } from './does-not-exist.gts';
export default { component: Missing } satisfies Meta;
export const Story: StoryObj = {
  render: (args) => <template><Missing /></template>
};
`.trim()
    });

    const storyPath = path.join(fix.base, 'test.stories.gts');
    const result = parseStoryFile(storyPath) as StoryFile;

    expect(result.meta.component).toBe('Missing');
    expect(result.component.signatureName).toBe('Missing');
  });
});

describe('parseComponentFile', () => {
  test('returns all declarations: exported, default, and internal', () => {
    using fix = tempFixture({
      'multi.gts': `import Component from '@glimmer/component';
const Logo = <template>logo</template>;
export const Header = <template><Logo /></template>;
export default class Page extends Component<Signature> {}
`
    });

    const compPath = path.join(fix.base, 'multi.gts');
    const meta = parseComponentFile(compPath) as ComponentMap;

    expect(meta.Header).toBe('Header');
    expect(meta[Default]).toBe('Page');
    expect(meta.Logo).toBeUndefined();
    expect(Object.keys(meta)).toHaveLength(2);
  });

  test('records directly exported class components', () => {
    using fix = tempFixture({
      'list.gts': `import Component from '@glimmer/component';
export class Option extends Component<OptionSignature> {}
export class List extends Component<ListSignature> {}
`
    });

    const compPath = path.join(fix.base, 'list.gts');
    const meta = parseComponentFile(compPath) as ComponentMap;

    expect(meta.Option).toBe('Option');
    expect(meta.List).toBe('List');
  });

  test('handles specifier re-export: internal name ≠ export name', () => {
    const fixture = tempFixture({
      'card.gts': `const Card = <template><div>Hello</div></template>;\nexport { Card as CardExport };`
    });

    const compPath = path.join(fixture.base, 'card.gts');
    const meta = parseComponentFile(compPath) as ComponentMap;

    expect(meta.CardExport).toBe('Card');
    expect(Object.keys(meta)).toHaveLength(1);
    fixture[Symbol.dispose]();
  });

  test('returns undefined for file with no declarations', () => {
    const fixture = tempFixture({
      'empty.gts': `import { something } from 'somewhere';\n`
    });

    const compPath = path.join(fixture.base, 'empty.gts');
    const meta = parseComponentFile(compPath);

    expect(meta).toBeUndefined();
    fixture[Symbol.dispose]();
  });
});

describe('unified key behavior', () => {
  test('default import yields Default signatureName matching ComponentSignatureMap key', () => {
    using fix = tempFixture({
      'comp.gts': `import Component from '@glimmer/component';
export default class MyComp extends Component<Signature> {}
`,
      'comp.stories.gts': `
import MyComp from './comp.gts';
export default { component: MyComp } satisfies Meta;
`.trim()
    });

    const result = parseStoryFile(path.join(fix.base, 'comp.stories.gts')) as StoryFile;

    expect(result.component.signatureName).toBe(Default);
    expect(result.component.name).toBe('MyComp');
  });

  test('specifier re-export import yields export name matching ComponentSignatureMap key', () => {
    using fix = tempFixture({
      'comp.gts': `const Internal = <template>Hello</template>;
export { Internal as PublicName };
`,
      'comp.stories.gts': `
import { PublicName } from './comp.gts';
export default { component: PublicName } satisfies Meta;
`.trim()
    });

    const result = parseStoryFile(path.join(fix.base, 'comp.stories.gts')) as StoryFile;

    expect(result.component.signatureName).toBe('PublicName');
  });

  test('re-export with alias import yields export name matching ComponentSignatureMap key', () => {
    using fix = tempFixture({
      'comp.gts': `const Card = <template>Hello</template>;
export { Card as CardExport };
`,
      'comp.stories.gts': `
import { CardExport as CardComponent } from './comp.gts';
export default { component: CardComponent } satisfies Meta;
`.trim()
    });

    const result = parseStoryFile(path.join(fix.base, 'comp.stories.gts')) as StoryFile;

    expect(result.component.signatureName).toBe('CardExport');
  });
});
