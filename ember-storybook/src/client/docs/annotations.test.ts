import { describe, expect, test, vi } from 'vitest';

import { argTypesEnhancers, extractArgTypes, parameters } from './annotations';

import type { EmberRenderer } from '../types';
import type { StoryContextForEnhancers } from 'storybook/internal/types';

vi.mock('virtual:ember-storybook', () => ({
  default: {
    'src/list.stories.gts': {
      meta: { title: 'List', component: 'List' },
      component: { file: 'src/list.gts', signatureName: 'List' },
      subcomponents: {
        ListItem: { file: 'src/item.gts', signatureName: 'ListItem' },
        Unresolved: { signatureName: 'Unresolved' }
      }
    },
    'src/item.gts': {
      meta: {},
      signatures: {
        ListItem: {
          args: {
            label: {
              type: { category: 'string', raw: 'string' },
              required: true,
              description: 'The item text',
              defaultValue: undefined
            }
          },
          blocks: {},
          element: undefined,
          style: { customProperties: {}, parts: {} }
        }
      }
    }
  }
}));

function enhance(subcomponents: Record<string, unknown>, component: unknown = {}) {
  const [enhancer] = argTypesEnhancers;

  enhancer({
    parameters: { fileName: 'src/list.stories.gts' },
    argTypes: {},
    component,
    subcomponents,
    title: 'List'
  } as unknown as StoryContextForEnhancers<EmberRenderer>);
}

describe('CSF subcomponents', () => {
  test('provides parameters.docs.extractArgTypes', () => {
    expect((parameters.docs as Record<string, unknown>).extractArgTypes).toBe(extractArgTypes);
  });

  test('extracts the args of a subcomponent from its signature', () => {
    const ListItem = { name: 'ListItem' };

    enhance({ ListItem });

    expect(extractArgTypes(ListItem)).toMatchObject({
      label: {
        name: 'label',
        description: 'The item text',
        type: { name: 'string', required: true }
      }
    });
  });

  test('reports no args for a subcomponent without a signature, instead of throwing', () => {
    const Unresolved = { name: 'Unresolved' };
    const Unknown = { name: 'Unknown' };

    enhance({ Unresolved });

    expect(extractArgTypes(Unresolved)).toEqual({});
    expect(extractArgTypes(Unknown)).toEqual({});
    expect(extractArgTypes(undefined)).toEqual({});
  });

  test('labels the main component with its story-file name, which minification keeps', () => {
    const minified = { name: 'Pe' };

    enhance({}, minified);

    expect((minified as { __docgenInfo?: unknown }).__docgenInfo).toEqual({ displayName: 'List' });
  });

  test('keeps a main component name that is already set', () => {
    const named = { __docgenInfo: { displayName: 'Custom' } };

    enhance({}, named);

    expect(named.__docgenInfo).toEqual({ displayName: 'Custom' });
  });
});
