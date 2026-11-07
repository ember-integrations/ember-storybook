import path from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import { parseEmberSignatures } from '../../client/docs/docgen-payload';
import { PROJECT_ROOT } from '../shared';
import { batched, signaturesFor } from './docgen';
import { emberStoryFileOf } from './provider';

import type { BlockParam, ComponentSignature, ComponentSignatureMap } from 'ember-docgen';
import type { IndexEntry } from 'storybook/internal/types';

function signature(yields: Record<string, string> = {}): ComponentSignature {
  const hash: Record<string, BlockParam> = {};

  for (const [name, filePath] of Object.entries(yields)) {
    hash[name] = { name, type: 'unknown', componentRef: { filePath, exportName: name } };
  }

  return {
    args: {},
    blocks: { default: { description: '', params: [hash] } },
    element: undefined,
    style: { customProperties: {}, parts: {} }
  };
}

const file = (relative: string) => path.resolve(PROJECT_ROOT, relative);

const entry = (fields: Partial<IndexEntry>) =>
  ({ id: 'button--docs', title: 'Button', name: 'Docs', tags: [], ...fields }) as IndexEntry;

describe('batched', () => {
  test('extracts the files asked for in one turn of the event loop together', async () => {
    const extract = vi.fn((): ComponentSignatureMap => ({}));
    const signaturesOf = batched(extract);

    await Promise.all([signaturesOf(file('a.gts')), signaturesOf(file('b.gts'))]);
    await signaturesOf(file('c.gts'));

    expect(extract.mock.calls).toEqual([[[file('a.gts'), file('b.gts')]], [[file('c.gts')]]]);
  });

  test('rejects every waiting caller when extraction throws', async () => {
    const signaturesOf = batched(() => {
      throw new Error('No program');
    });

    const [a, b] = [file('a.gts'), file('b.gts')];
    const waiting = Promise.all([signaturesOf(a), signaturesOf(b)]);

    await expect(waiting).rejects.toThrow('No program');
  });
});

describe('signaturesFor', () => {
  test('collects the files its blocks yield components from, once each', () => {
    const extracted = new Map<string, Record<string, ComponentSignature>>([
      [file('list.gts'), { List: signature({ Item: './item.gts', Other: './list.gts' }) }],
      [file('item.gts'), { Item: signature({ Missing: './missing.gts' }) }],
      [file('unrelated.gts'), { Unrelated: signature() }]
    ]);

    const collected = signaturesFor(file('list.gts'), extracted);

    expect(Object.keys(collected)).toEqual(['./list.gts', './item.gts']);
  });
});

describe('emberStoryFileOf', () => {
  test('takes an autodocs entry’s own story file', () => {
    expect(
      emberStoryFileOf(
        entry({ type: 'docs', importPath: './button.stories.gts', storiesImports: [] })
      )
    ).toBe('./button.stories.gts');
  });

  test('takes the story file an MDX page is attached to', () => {
    expect(
      emberStoryFileOf(
        entry({
          type: 'docs',
          importPath: './button.mdx',
          storiesImports: ['./button.stories.gts'],
          tags: ['attached-mdx']
        })
      )
    ).toBe('./button.stories.gts');
  });

  test('leaves other story files to other providers', () => {
    expect(emberStoryFileOf(entry({ type: 'story', importPath: './button.stories.tsx' }))).toBe(
      undefined
    );
    expect(
      emberStoryFileOf(entry({ type: 'docs', importPath: './intro.mdx', storiesImports: [] }))
    ).toBe(undefined);
  });
});

describe('parseEmberSignatures', () => {
  test('reads the signatures a payload carries as JSON', () => {
    const signatures = { './list.gts': { List: signature() } };
    const payload = { id: 'list', name: 'List', path: './list.stories.gts', jsDocTags: {} };

    expect(
      parseEmberSignatures({ ...payload, emberSignatures: JSON.stringify(signatures) })
    ).toEqual(signatures);
    expect(parseEmberSignatures(payload)).toEqual({});
    expect(parseEmberSignatures(undefined)).toEqual({});
  });
});
