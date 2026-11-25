import { describe, expect, test } from 'vitest';

import { apiDescription, describeComponent, storyExamples } from './manifest';

import type { StoryFile } from './parser';
import type { ComponentSignature } from 'ember-docgen';
import type { IndexEntry } from 'storybook/internal/types';

const signature: ComponentSignature = {
  args: {
    kind: {
      type: { category: 'union', raw: "'primary' | 'secondary'" },
      required: true,
      description: 'The button style'
    },
    disabled: {
      type: { category: 'boolean', raw: 'boolean' },
      required: false,
      description: '',
      defaultValue: 'false'
    }
  },
  blocks: {
    default: {
      params: [
        {
          name: 'Item',
          type: 'Invokable<(named: PrebindArgs<{ list: List }, "list">) => ComponentReturn<{}>>',
          componentRef: { filePath: './item.gts', exportName: 'Item' }
        },
        { name: 'index', type: 'number', description: 'Position in the list' }
      ]
    },
    header: { params: [], description: 'Shown above the list' }
  },
  element: 'HTMLButtonElement',
  style: { customProperties: {}, parts: {} }
};

describe('apiDescription', () => {
  test('describes args, blocks and the splattributes element', () => {
    expect(apiDescription(signature)).toBe(
      [
        '## Arguments',
        '',
        '| Name | Type | Default | Description |',
        '| --- | --- | --- | --- |',
        "| `@kind` (required) | `'primary' \\| 'secondary'` |  | The button style |",
        '| `@disabled` | `boolean` | `false` |  |',
        '',
        '## Blocks',
        '',
        '- default block',
        '  - yields `Item` (component)',
        '  - yields `index` (`number`): Position in the list',
        '- `<:header>`: Shown above the list',
        '',
        '## Element',
        '',
        '`...attributes` are applied to `HTMLButtonElement`.'
      ].join('\n')
    );
  });

  test('omits sections the signature does not declare', () => {
    expect(
      apiDescription({ args: {}, blocks: {}, element: undefined, style: signature.style })
    ).toBe('');
  });
});

function storyFile(fields: Partial<StoryFile>): StoryFile {
  return {
    meta: {},
    component: {},
    stories: [],
    docs: { args: {}, stories: {} },
    ...fields
  };
}

describe('describeComponent', () => {
  test('names a default export after its declaration and imports it from its package', () => {
    const parsed = storyFile({
      component: { file: './src/button.gts', signatureName: '__DEFAULT__', name: 'Button' },
      docs: { args: {}, stories: {}, description: 'Buttons start actions.' }
    });

    expect(describeComponent(parsed, { __DEFAULT__: signature }, 'Fallback')).toEqual({
      name: 'Button',
      description: 'Buttons start actions.',
      import: "import Button from 'ember-storybook/button';",
      apiDescription: apiDescription(signature),
      signature
    });
  });

  test('falls back to the title for a component the story file does not import', () => {
    expect(describeComponent(undefined, undefined, 'Button')).toEqual({
      name: 'Button',
      description: undefined,
      import: undefined,
      apiDescription: undefined,
      signature: undefined
    });
  });
});

const entry = (id: string, fields: Partial<IndexEntry> = {}) =>
  ({ id, name: id, type: 'story', subtype: 'story', ...fields }) as IndexEntry;

describe('storyExamples', () => {
  test('uses a story’s own template, else invokes the component with its args', () => {
    const parsed = storyFile({
      stories: [
        { id: 'list--custom', inlineTemplate: '<List @label={{args.label}} />' }
      ] as StoryFile['stories'],
      docs: {
        args: { label: 'Fruit' },
        stories: { 'list--plain': { args: {}, description: 'Plain' } }
      }
    });
    const component = { name: 'List', signature: undefined };

    expect(
      storyExamples(parsed, component, [
        entry('list--custom'),
        entry('list--plain'),
        entry('list--plain:test', { subtype: 'test' }),
        entry('list--docs', { type: 'docs' })
      ])
    ).toEqual([
      {
        id: 'list--custom',
        name: 'list--custom',
        description: undefined,
        snippet: '<List @label="Fruit" />'
      },
      {
        id: 'list--plain',
        name: 'list--plain',
        description: 'Plain',
        snippet: '<List @label="Fruit" />'
      }
    ]);
  });
});
