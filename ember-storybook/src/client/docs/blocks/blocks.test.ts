import { createContext, isValidElement, type ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { BlocksTable } from './blocks';

import type { BlockInfo } from 'ember-docgen';

// Storybook's docs blocks need a DOM to load; the table uses none of them.
vi.mock('@storybook/addon-docs/blocks', () => ({
  DocsContext: createContext(undefined),
  Heading: 'h2',
  Markdown: 'span',
  Subheading: 'h3'
}));

/** The text a rendered element tree holds, in order. */
function textOf(root: ReactNode): string[] {
  const text: string[] = [];
  const pending: ReactNode[] = [root];

  while (pending.length > 0) {
    const node = pending.shift();

    if (typeof node === 'string' || typeof node === 'number') {
      text.push(String(node));
    } else if (Array.isArray(node)) {
      pending.unshift(...(node as ReactNode[]));
    } else if (isValidElement<{ children?: ReactNode }>(node)) {
      pending.unshift(node.props.children);
    }
  }

  return text;
}

function blocksTable(blocks: Record<string, BlockInfo>) {
  return textOf(BlocksTable({ blocks, subcomponentNames: new Set() }));
}

describe('BlocksTable', () => {
  test("shows each block's description", () => {
    expect(
      blocksTable({
        default: { params: [], description: 'The label' },
        before: { params: [], description: '' }
      })
    ).toEqual(['<:default>', 'The label', '<:before>']);
  });

  test("puts a block's description before its params", () => {
    expect(
      blocksTable({
        default: {
          params: [{ name: 'item', type: 'string', description: 'The item' }],
          description: 'The items'
        }
      })
    ).toEqual(['<:default>', 'The items', '- ', 'item', ': ', 'string', 'The item']);
  });

  test('lists the default block first', () => {
    const block = { params: [], description: '' };

    expect(blocksTable({ default: block, header: block, footer: block })).toEqual([
      '<:default>',
      '<:header>',
      '<:footer>'
    ]);
    expect(blocksTable({ header: block, footer: block, default: block })).toEqual([
      '<:default>',
      '<:header>',
      '<:footer>'
    ]);
  });
});
