import { describe, expect, test, vi } from 'vitest';

import { buildArgTypes, mergeArgTypes, shouldShowArgsSection } from './extractArgTypes';

import type { ArgTypeInfo, ComponentSignature } from 'ember-docgen';

vi.mock('virtual:ember-storybook', () => ({ default: {} }));

/** The `table.type.detail` built for a single arg of the given type. */
function typeDetailOf(type: ArgTypeInfo): string | undefined {
  const result = buildArgTypes({
    args: { arg: { type, required: false, description: '' } },
    blocks: {},
    element: undefined,
    style: { customProperties: {}, parts: {} }
  });

  return (result.arg as { table: { type: { detail?: string } } }).table.type.detail;
}

describe('buildArgTypes', () => {
  const fullSignature: ComponentSignature = {
    args: {
      greeting: {
        type: { category: 'string', raw: 'string' },
        required: true,
        description: 'The greeting to display',
        defaultValue: undefined
      },
      count: {
        type: { category: 'number', raw: 'number' },
        required: true,
        description: 'Number of items',
        defaultValue: undefined
      },
      push: {
        type: { category: 'function', raw: '(value: string) => void' },
        required: false,
        description: 'Click handler',
        defaultValue: undefined
      }
    },
    blocks: {
      head: {
        params: [
          { name: 'title', type: 'string' },
          { name: 'subtitle', type: 'string' }
        ],
        description: 'The header block content'
      },
      footer: {
        params: [],
        description: undefined
      }
    },
    element: 'HTMLDivElement',
    style: {
      customProperties: {
        '--color': 'primary',
        '--spacing': 'md'
      },
      parts: {
        card: 'The outer wrapper',
        header: 'The header area'
      }
    }
  };

  const minimalSignature: ComponentSignature = {
    args: {},
    blocks: {},
    element: undefined,
    style: { customProperties: {}, parts: {} }
  };

  test('maps Args to interactive controls with the Args category', () => {
    const result = buildArgTypes(fullSignature);

    expect(result.greeting).toMatchObject({
      name: 'greeting',
      type: { name: 'string', required: true },
      control: { type: 'text' },
      table: { type: { summary: 'string' } }
    });

    expect(result.count).toMatchObject({
      name: 'count',
      type: { name: 'number', required: true },
      control: { type: 'number' },
      table: { type: { summary: 'number' } }
    });

    expect(result.push).toMatchObject({
      name: 'push',
      type: { name: '(value: string) => void', required: false },
      control: { type: 'function' },
      table: { type: { summary: '(value: string) => void' } }
    });
  });

  test('returns empty object for empty signature', () => {
    const result = buildArgTypes(minimalSignature);

    expect(Object.keys(result)).toHaveLength(0);
  });

  test('preserves the signature declaration order of args', () => {
    const sig: ComponentSignature = {
      args: {
        zebra: {
          type: { category: 'string', raw: 'string' },
          required: false,
          description: '',
          defaultValue: undefined
        },
        alpha: {
          type: { category: 'number', raw: 'number' },
          required: false,
          description: '',
          defaultValue: undefined
        },
        mike: {
          type: { category: 'boolean', raw: 'boolean' },
          required: false,
          description: '',
          defaultValue: undefined
        }
      },
      blocks: {},
      element: undefined,
      style: { customProperties: {}, parts: {} }
    };

    const result = buildArgTypes(sig);

    expect(Object.keys(result)).toEqual(['zebra', 'alpha', 'mike']);
  });

  test('includes defaultValue when present', () => {
    const sig: ComponentSignature = {
      args: {
        name: {
          type: { category: 'string', raw: 'string' },
          required: false,
          description: '',
          defaultValue: 'World'
        }
      },
      blocks: {},
      element: undefined,
      style: { customProperties: {}, parts: {} }
    };

    const result = buildArgTypes(sig);

    expect((result.name as { table: { defaultValue: unknown } }).table.defaultValue).toEqual({
      summary: 'World'
    });
  });

  // Same shapes as the ember-docgen `unfolds object-typed args` tests produce
  describe('type detail', () => {
    const widgetArgs: ArgTypeInfo = {
      category: 'object',
      raw: 'WidgetArgs',
      properties: {
        label: {
          type: { category: 'string', raw: 'string' },
          required: true,
          description: 'Label of the widget'
        },
        subtitle: {
          type: { category: 'string', raw: 'string' },
          required: false,
          description: 'Shown for extra details about the widget'
        },
        size: {
          type: { category: 'enum', raw: '"sm" | "md" | "lg"', options: ['sm', 'md', 'lg'] },
          required: false,
          description: 'Size of the widget',
          defaultValue: "'md'"
        }
      }
    };

    const widgetFields = [
      '  /** Label of the widget */',
      '  label: string;',
      '  /** Shown for extra details about the widget */',
      '  subtitle?: string;',
      '  /** Size of the widget */',
      '  size?: "sm" | "md" | "lg";'
    ];

    test('prints the fields of an object-typed arg', () => {
      expect(typeDetailOf(widgetArgs)).toBe(['{', ...widgetFields, '}'].join('\n'));

      // Same for the element type of an array of objects
      expect(
        typeDetailOf({ category: 'array', raw: 'WidgetArgs[]', elementType: widgetArgs })
      ).toBe(['{', ...widgetFields, '}[]'].join('\n'));
    });

    test('prints nested objects', () => {
      // `{ icon: string } & { tooltip?: { title: string } }`, once ember-docgen unfolds it
      const detail = typeDetailOf({
        category: 'object',
        raw: 'IconSpec',
        properties: {
          icon: { type: { category: 'string', raw: 'string' }, required: true, description: '' },
          tooltip: {
            type: {
              category: 'object',
              raw: '{ title: string; }',
              properties: {
                title: {
                  type: { category: 'string', raw: 'string' },
                  required: true,
                  description: 'Text of the tooltip'
                }
              }
            },
            required: false,
            description: ''
          }
        }
      });

      expect(detail).toBe(
        [
          '{',
          '  icon: string;',
          '  tooltip?: {',
          '    /** Text of the tooltip */',
          '    title: string;',
          '  };',
          '}'
        ].join('\n')
      );
    });

    test('quotes the keys that are not identifiers', () => {
      const detail = typeDetailOf({
        category: 'object',
        raw: 'WidgetAttributes',
        properties: {
          'data-test-widget': {
            type: { category: 'string', raw: 'string' },
            required: false,
            description: ''
          }
        }
      });

      expect(detail).toBe(['{', '  "data-test-widget"?: string;', '}'].join('\n'));
    });

    test('wraps union and function array elements in parentheses', () => {
      const detail = typeDetailOf({
        category: 'object',
        raw: 'WidgetGroup',
        properties: {
          sizes: {
            type: {
              category: 'array',
              raw: '("sm" | "md")[]',
              elementType: { category: 'enum', raw: '"sm" | "md"', options: ['sm', 'md'] }
            },
            required: true,
            description: ''
          },
          handlers: {
            type: {
              category: 'array',
              raw: '(() => void)[]',
              elementType: { category: 'function', raw: '() => void' }
            },
            required: true,
            description: ''
          }
        }
      });

      expect(detail).toBe(
        ['{', '  sizes: ("sm" | "md")[];', '  handlers: (() => void)[];', '}'].join('\n')
      );
    });

    test('has no type detail for args that are not objects', () => {
      expect(typeDetailOf({ category: 'string', raw: 'string' })).toBeUndefined();
      expect(
        typeDetailOf({ category: 'enum', raw: '"sm" | "md"', options: ['sm', 'md'] })
      ).toBeUndefined();
      expect(typeDetailOf({ category: 'function', raw: '() => void' })).toBeUndefined();
      expect(
        typeDetailOf({
          category: 'array',
          raw: 'string[]',
          elementType: { category: 'string', raw: 'string' }
        })
      ).toBeUndefined();
    });
  });
});

describe('mergeArgTypes', () => {
  const signatureArgTypes = buildArgTypes({
    args: {
      size: {
        type: {
          category: 'enum',
          raw: 'small | medium | large',
          options: ['small', 'medium', 'large']
        },
        required: false,
        description: 'How large should the button be?',
        defaultValue: undefined
      },
      push: {
        type: { category: 'function', raw: '() => void' },
        required: true,
        description: 'Click handler',
        defaultValue: undefined
      }
    },
    blocks: {},
    element: undefined,
    style: { customProperties: {}, parts: {} }
  });

  // https://github.com/ember-integrations/ember-storybook/issues/45 (Case 1)
  test('keeps signature-derived type, table and description when the story only enhances control/options', () => {
    const storyArgTypes = {
      size: { control: { type: 'radio' }, options: ['small', 'medium', 'large'] }
    };

    const result = mergeArgTypes(signatureArgTypes, storyArgTypes);

    expect(result.size).toMatchObject({
      description: 'How large should the button be?',
      type: { name: 'small | medium | large', required: false },
      control: { type: 'radio' },
      options: ['small', 'medium', 'large'],
      table: { type: { summary: 'small | medium | large' } }
    });
  });

  test('lets story-provided values win where both sides define the same field', () => {
    const storyArgTypes = {
      size: {
        name: 'Size',
        description: 'Custom size description',
        control: { type: 'radio' }
      }
    };

    const result = mergeArgTypes(signatureArgTypes, storyArgTypes);

    // story wins on fields the signature also defines
    expect(result.size).toMatchObject({
      name: 'Size',
      description: 'Custom size description',
      control: { type: 'radio' }
    });

    // fields only the signature defines are preserved
    expect(result.size).toMatchObject({
      type: { name: 'small | medium | large', required: false },
      table: { type: { summary: 'small | medium | large' } }
    });
  });

  test('does not overwrite signature values with undefined story values', () => {
    const storyArgTypes = {
      size: { description: undefined, control: undefined }
    };

    const result = mergeArgTypes(signatureArgTypes, storyArgTypes);

    expect(result.size).toMatchObject({
      description: 'How large should the button be?',
      control: { type: 'select', options: ['small', 'medium', 'large'] }
    });
  });

  test('keeps story-only argTypes that are not in the signature', () => {
    const storyArgTypes = {
      backgroundColor: { control: 'color' }
    };

    const result = mergeArgTypes(signatureArgTypes, storyArgTypes);

    expect(result.backgroundColor).toEqual({ control: 'color' });
    expect(result.size).toBeDefined();
  });

  test('keeps signature-only argTypes the story does not mention', () => {
    const result = mergeArgTypes(signatureArgTypes, {});

    expect(result.size).toEqual(signatureArgTypes.size);
    expect(result.push).toEqual(signatureArgTypes.push);
  });

  // https://github.com/ember-integrations/ember-storybook/issues/48
  test('keeps signature `required` when the story provides a partial `type`', () => {
    const storyArgTypes = {
      push: { type: { name: '() => void' } }
    };

    const result = mergeArgTypes(signatureArgTypes, storyArgTypes);

    expect(result.push).toMatchObject({
      type: { name: '() => void', required: true }
    });
  });

  test('lets the story override `required` explicitly', () => {
    const storyArgTypes = {
      push: { type: { name: '() => void', required: false } }
    };

    const result = mergeArgTypes(signatureArgTypes, storyArgTypes);

    expect(result.push).toMatchObject({
      type: { name: '() => void', required: false }
    });
  });

  test('lets the story override `type.name` while keeping the signature `required`', () => {
    const storyArgTypes = {
      push: { type: { name: 'ClickHandler' } }
    };

    const result = mergeArgTypes(signatureArgTypes, storyArgTypes);

    expect(result.push).toMatchObject({
      type: { name: 'ClickHandler', required: true }
    });
  });

  test('puts story-defined keys first, in the order the user defined them', () => {
    const result = mergeArgTypes(signatureArgTypes, {
      push: { description: 'Custom handler' },
      size: { control: { type: 'radio' } }
    });

    expect(Object.keys(result)).toEqual(['push', 'size']);
  });

  test('orders merged keys as user keys first, then untouched signature keys in declaration order', () => {
    const sigArgTypes = buildArgTypes({
      args: {
        zebra: {
          type: { category: 'string', raw: 'string' },
          required: false,
          description: '',
          defaultValue: undefined
        },
        alpha: {
          type: { category: 'number', raw: 'number' },
          required: false,
          description: '',
          defaultValue: undefined
        },
        mike: {
          type: { category: 'boolean', raw: 'boolean' },
          required: false,
          description: '',
          defaultValue: undefined
        }
      },
      blocks: {},
      element: undefined,
      style: { customProperties: {}, parts: {} }
    });

    const result = mergeArgTypes(sigArgTypes, {
      middle: { control: 'text' },
      alpha: { name: 'Alpha' }
    });

    // user keys in definition order, then the remaining signature keys
    expect(Object.keys(result)).toEqual(['middle', 'alpha', 'zebra', 'mike']);
  });
});

describe('shouldShowArgsSection', () => {
  const signatureWithArgs: ComponentSignature = {
    args: {
      size: {
        type: { category: 'enum', raw: 'small | medium | large' },
        required: false,
        description: '',
        defaultValue: undefined
      }
    },
    blocks: {},
    element: undefined,
    style: { customProperties: {}, parts: {} }
  };

  const signatureWithoutArgs: ComponentSignature = {
    args: {},
    blocks: {},
    element: undefined,
    style: { customProperties: {}, parts: {} }
  };

  test('returns true when the signature has args', () => {
    expect(shouldShowArgsSection(signatureWithArgs, undefined)).toBe(true);
  });

  // https://github.com/ember-integrations/ember-storybook/issues/45 (Case 2)
  test('returns true for a signature without args when story argTypes exist', () => {
    expect(shouldShowArgsSection(signatureWithoutArgs, { position: { control: 'radio' } })).toBe(
      true
    );
  });

  test('returns false when neither the signature nor the meta has argTypes', () => {
    expect(shouldShowArgsSection(signatureWithoutArgs, undefined)).toBe(false);
    expect(shouldShowArgsSection(signatureWithoutArgs, {})).toBe(false);
  });
});
