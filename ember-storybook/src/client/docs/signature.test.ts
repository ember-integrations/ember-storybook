import { Default } from 'ember-docgen';
import { describe, expect, test } from 'vitest';

import { applyModifiers, collectSubcomponents, componentDisplayName } from './signature';

import type { EmberMeta } from '../../node/types';
import type { BlockParam, ComponentSignature } from 'ember-docgen';

const OPTION_FULL: ComponentSignature = {
  args: {
    value: { type: { category: 'other', raw: 'V' }, required: true, description: '' },
    isSelected: {
      type: { category: 'function', raw: '(option: V) => boolean' },
      required: true,
      description: ''
    },
    registerItem: {
      type: { category: 'function', raw: '(item: V) => void' },
      required: true,
      description: ''
    },
    unregisterItem: {
      type: { category: 'function', raw: '(item: V) => void' },
      required: true,
      description: ''
    }
  },
  blocks: { default: { params: [], description: '' } },
  element: 'HTMLOptionElement',
  style: { customProperties: {}, parts: {} }
};

describe('applyModifiers', () => {
  test('returns signature unchanged when no modifiers', () => {
    const result = applyModifiers(OPTION_FULL, undefined);

    expect(result.args).toEqual(OPTION_FULL.args);
  });

  test('WithBoundArgs removes specified keys from args', () => {
    const result = applyModifiers(OPTION_FULL, [
      { name: 'WithBoundArgs', typeArgs: ['isSelected', 'registerItem', 'unregisterItem'] }
    ]);

    expect(Object.keys(result.args)).toEqual(['value']);
    expect(result.args.value).toEqual(OPTION_FULL.args.value);
  });

  test('Omit removes specified keys from args', () => {
    const result = applyModifiers(OPTION_FULL, [
      { name: 'Omit', typeArgs: ['registerItem', 'unregisterItem'] }
    ]);

    expect(Object.keys(result.args)).toEqual(['value', 'isSelected']);
  });

  test('Pick keeps only specified keys from args', () => {
    const result = applyModifiers(OPTION_FULL, [
      { name: 'Pick', typeArgs: ['value', 'isSelected'] }
    ]);

    expect(Object.keys(result.args)).toEqual(['value', 'isSelected']);
  });

  test('multiple modifiers chain correctly: WithBoundArgs + extra Omit', () => {
    const sig: ComponentSignature = {
      args: {
        a: { type: { category: 'string', raw: 'string' }, required: true, description: '' },
        b: { type: { category: 'string', raw: 'string' }, required: true, description: '' },
        c: { type: { category: 'string', raw: 'string' }, required: true, description: '' }
      },
      blocks: {},
      element: undefined,
      style: { customProperties: {}, parts: {} }
    };

    const result = applyModifiers(sig, [
      { name: 'WithBoundArgs', typeArgs: ['a'] },
      { name: 'Omit', typeArgs: ['b'] }
    ]);

    expect(Object.keys(result.args)).toEqual(['c']);
  });

  test('Pick takes precedence over Omit/WithBoundArgs', () => {
    const sig: ComponentSignature = {
      args: {
        a: { type: { category: 'string', raw: 'string' }, required: true, description: '' },
        b: { type: { category: 'string', raw: 'string' }, required: true, description: '' },
        c: { type: { category: 'string', raw: 'string' }, required: true, description: '' }
      },
      blocks: {},
      element: undefined,
      style: { customProperties: {}, parts: {} }
    };

    const result = applyModifiers(sig, [
      { name: 'Pick', typeArgs: ['a'] },
      { name: 'Omit', typeArgs: ['a'] }
    ]);

    // Pick captures 'a', Omit is ignored when Pick is present
    expect(Object.keys(result.args)).toEqual(['a']);
  });
});

describe('collectSubcomponents', () => {
  test('WithBoundArgs modifier filters args on the subcomponent', () => {
    const blocks: Record<string, { params: BlockParam[] }> = {
      default: {
        params: [
          {
            name: 'Option',
            type: 'Invokable',
            componentRef: {
              filePath: './app/components/list.gts',
              exportName: 'Option',
              modifiers: [
                {
                  name: 'WithBoundArgs',
                  typeArgs: ['isSelected', 'registerItem', 'unregisterItem']
                }
              ]
            }
          }
        ]
      }
    };

    const data: EmberMeta = {
      './app/components/list.gts': {
        meta: {},
        signatures: { Option: OPTION_FULL }
      }
    };

    const result = collectSubcomponents(blocks, data);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Option');

    const signature = result[0].signature;

    expect(signature).toBeDefined();
    expect(Object.keys(signature?.args ?? {})).toEqual(['value']);
    expect(signature?.element).toBe('HTMLOptionElement');
    expect(signature?.blocks.default).toBeDefined();
  });

  test('deduplicates params with same name', () => {
    const blocks: Record<string, { params: BlockParam[] }> = {
      default: {
        params: [
          {
            name: 'Option',
            type: 'Invokable',
            componentRef: {
              filePath: './app/components/list.gts',
              exportName: 'Option',
              modifiers: [{ name: 'WithBoundArgs', typeArgs: ['isSelected'] }]
            }
          },
          {
            name: 'Option',
            type: 'Invokable',
            componentRef: {
              filePath: './app/components/list.gts',
              exportName: 'Option',
              modifiers: [{ name: 'WithBoundArgs', typeArgs: ['isSelected'] }]
            }
          }
        ]
      }
    };

    const data: EmberMeta = {
      './app/components/list.gts': {
        meta: {},
        signatures: { Option: OPTION_FULL }
      }
    };

    const result = collectSubcomponents(blocks, data);

    expect(result).toHaveLength(1);
  });

  test('external importPath subcomponent returns import info', () => {
    const blocks: Record<string, { params: BlockParam[] }> = {
      default: {
        params: [
          {
            name: 'Button',
            type: 'Invokable',
            componentRef: {
              filePath: './node_modules/@ui-lib/button.d.ts',
              exportName: 'Button',
              importPath: '@ui-lib'
            }
          }
        ]
      }
    };

    const result = collectSubcomponents(blocks, {});

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Button');
    expect(result[0].importPath).toBe('@ui-lib');
    expect(result[0].signature).toBeUndefined();
  });

  test('names subcomponent by its own declaration name when the yield-hash key differs', () => {
    const blocks: Record<string, { params: BlockParam[] }> = {
      default: {
        params: [
          {
            name: 'Items',
            type: 'Invokable',
            componentRef: {
              filePath: './app/components/list.gts',
              exportName: 'Option'
            }
          }
        ]
      }
    };

    const data: EmberMeta = {
      './app/components/list.gts': {
        meta: { Option: 'Option' },
        signatures: { Option: OPTION_FULL }
      }
    };

    const result = collectSubcomponents(blocks, data);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Option');
  });

  test('resolves the Default sentinel to the class name via the component map', () => {
    const ref = { filePath: './app/components/card.gts', exportName: Default };

    const data: EmberMeta = {
      './app/components/card.gts': {
        meta: { [Default]: 'Card' },
        signatures: {}
      }
    };

    expect(componentDisplayName(ref, data)).toBe('Card');
  });

  test('resolves export aliases to the internal declaration name', () => {
    const ref = { filePath: './app/components/card.gts', exportName: 'CardExport' };

    const data: EmberMeta = {
      './app/components/card.gts': {
        meta: { CardExport: 'Card' },
        signatures: {}
      }
    };

    expect(componentDisplayName(ref, data)).toBe('Card');
  });

  test('lists template-only subcomponents without a signature by name only', () => {
    const blocks: Record<string, { params: BlockParam[] }> = {
      default: {
        params: [
          {
            name: 'Section',
            type: 'Invokable',
            componentRef: { filePath: './app/components/section.gts', exportName: Default }
          }
        ]
      }
    };

    const result = collectSubcomponents(blocks, {});

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Section');
    expect(result[0].signature).toBeUndefined();
  });
});
