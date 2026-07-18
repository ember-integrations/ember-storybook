import { describe, expect, it, vi } from 'vitest';

import { buildArgTypes, extractArgTypes } from './extractArgTypes';

import type { ComponentSignature } from '../../node/typedoc/types';

vi.mock('virtual:ember-storybook', () => ({ default: {} }));

describe('buildArgTypes', () => {
  const fullSignature: ComponentSignature = {
    args: {
      greeting: {
        type: 'string',
        required: true,
        description: 'The greeting to display',
        defaultValue: undefined
      },
      count: {
        type: 'number',
        required: true,
        description: 'Number of items',
        defaultValue: undefined
      },
      push: {
        type: '(value: string) => void',
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
      table: { category: 'Args', type: { summary: 'string' } }
    });

    expect(result.count).toMatchObject({
      name: 'count',
      type: { name: 'number', required: true },
      control: { type: 'number' },
      table: { category: 'Args', type: { summary: 'number' } }
    });

    expect(result.push).toMatchObject({
      name: 'push',
      type: { name: '(value: string) => void', required: false },
      control: { type: 'object' },
      table: { category: 'Args', type: { summary: '(value: string) => void' } }
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
          type: 'string',
          required: false,
          description: '',
          defaultValue: "'World'"
        }
      },
      blocks: {},
      element: undefined,
      style: { customProperties: {}, parts: {} }
    };

    const result = buildArgTypes(sig);

    expect((result.name as { defaultValue: unknown }).defaultValue).toEqual({ summary: "'World'" });
  });
});

describe('extractArgTypes', () => {
  it('returns null for unnamed objects', () => {
    expect(extractArgTypes({})).toBeNull();
    expect(extractArgTypes({ foo: 'bar' })).toBeNull();
  });

  it('returns null when component name has no signature', () => {
    expect(extractArgTypes({ name: 'Unknown' })).toBeNull();
    expect(extractArgTypes({ displayName: 'Unknown' })).toBeNull();
  });

  it('uses displayName as fallback', () => {
    expect(extractArgTypes({ displayName: 'Unknown' })).toBeNull();
  });
});
