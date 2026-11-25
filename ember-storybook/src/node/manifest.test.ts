import { describe, expect, test } from 'vitest';

import { apiDescription } from './manifest';

import type { ComponentSignature } from 'ember-docgen';

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
