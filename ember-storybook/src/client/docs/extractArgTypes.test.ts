import { describe, expect, it, vi } from 'vitest';

import { buildArgTypes } from './extractArgTypes';

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
