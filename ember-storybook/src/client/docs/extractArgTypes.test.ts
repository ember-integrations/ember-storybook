import { describe, expect, it, vi } from 'vitest';

import { buildArgTypes, mergeArgTypes, shouldShowArgsSection } from './extractArgTypes';

import type { ComponentSignature } from 'ember-docgen';

vi.mock('virtual:ember-storybook', () => ({ default: {} }));

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

  it('maps Args to interactive controls with the Args category', () => {
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

  it('returns empty object for empty signature', () => {
    const result = buildArgTypes(minimalSignature);

    expect(Object.keys(result)).toHaveLength(0);
  });

  it('includes defaultValue when present', () => {
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
  it('keeps signature-derived type, table and description when the story only enhances control/options', () => {
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

  it('lets story-provided values win when present', () => {
    const storyArgTypes = {
      size: { name: 'Size', control: { type: 'radio' }, options: ['small', 'medium', 'large'] }
    };

    const result = mergeArgTypes(signatureArgTypes, storyArgTypes);

    expect(result.size).toMatchObject({
      name: 'Size',
      control: { type: 'radio' },
      options: ['small', 'medium', 'large']
    });
  });

  it('does not overwrite signature values with undefined story values', () => {
    const storyArgTypes = {
      size: { description: undefined, control: undefined }
    };

    const result = mergeArgTypes(signatureArgTypes, storyArgTypes);

    expect(result.size).toMatchObject({
      description: 'How large should the button be?',
      control: { type: 'select', options: ['small', 'medium', 'large'] }
    });
  });

  it('keeps story-only argTypes that are not in the signature', () => {
    const storyArgTypes = {
      backgroundColor: { control: 'color' }
    };

    const result = mergeArgTypes(signatureArgTypes, storyArgTypes);

    expect(result.backgroundColor).toEqual({ control: 'color' });
    expect(result.size).toBeDefined();
  });

  it('keeps signature-only argTypes the story does not mention', () => {
    const result = mergeArgTypes(signatureArgTypes, {});

    expect(result.size).toEqual(signatureArgTypes.size);
    expect(result.push).toEqual(signatureArgTypes.push);
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

  it('returns true when the signature has args', () => {
    expect(shouldShowArgsSection(signatureWithArgs, undefined)).toBe(true);
  });

  // https://github.com/ember-integrations/ember-storybook/issues/45 (Case 2)
  it('returns true for a signature without args when story argTypes exist', () => {
    expect(shouldShowArgsSection(signatureWithoutArgs, { position: { control: 'radio' } })).toBe(
      true
    );
  });

  it('returns false when neither the signature nor the meta has argTypes', () => {
    expect(shouldShowArgsSection(signatureWithoutArgs, undefined)).toBe(false);
    expect(shouldShowArgsSection(signatureWithoutArgs, {})).toBe(false);
  });
});
