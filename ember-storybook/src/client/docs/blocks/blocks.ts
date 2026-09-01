import { DocsContext, Subheading } from '@storybook/addon-docs/blocks';
import { createElement, Fragment, type MouseEvent, type ReactNode, useContext } from 'react';
import { NAVIGATE_URL } from 'storybook/internal/core-events';
import { styled } from 'storybook/theming';

import { componentDisplayName } from '../signature';
import { TableWrapper } from './ui';

import type { EmberMeta } from '../../../node/types';
import type { BlockInfo, BlockParam, HashBlockParam } from 'ember-docgen';

export const ParamType = styled.code(({ theme }) => ({
  color: theme.color.secondary,
  fontSize: 12,
  fontWeight: 'bold'
}));

const ParamName = styled.span(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.color.defaultText
}));

export const ParamRow = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2 - 1,
  lineHeight: '19px',
  marginBottom: 2
}));

const ParamDesc = styled.div(({ theme }) => ({
  color: theme.textMutedColor as string,
  fontSize: theme.typography.size.s1,
  lineHeight: '17px',
  marginBottom: 8,
  marginLeft: 20
}));

const BlocksDiv = styled.div(() => ({
  marginTop: 25,
  marginBottom: 40
}));

const BlocksNameCell = styled.td(({ theme }) => ({
  position: 'relative',
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s1,
  background: `${theme.background.app} !important`,
  '& ~ td': {
    background: `${theme.background.app} !important`
  }
}));

const SubcomponentLink = styled.a(({ theme }) => ({
  color: theme.color.primary,
  fontWeight: 'bold',
  cursor: 'pointer',
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' }
}));

const CodeLine = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2 - 1,
  lineHeight: '19px'
}));

/**
 * In-page anchor to a subcomponent section. Mirrors Storybook's own
 * in-docs navigation (TableOfContents / AnchorInPage): the default anchor
 * behavior is prevented — it would resolve against the preview iframe's
 * `<base>` and navigate away from Storybook — and instead the docs page
 * scrolls to the target while `NAVIGATE_URL` keeps the address-bar hash
 * (deep-linkable) in sync via the manager.
 */
function SubcomponentAnchor({ name, children }: { name: string; children?: ReactNode }) {
  const context = useContext(DocsContext);
  const hash = `#subcomponent-${name}`;

  return createElement(
    SubcomponentLink,
    {
      href: hash,
      target: '_self',
      onClick: (event: MouseEvent) => {
        event.preventDefault();

        const target = document.querySelector(`#${CSS.escape(hash.slice(1))}`);

        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          context.channel.emit(NAVIGATE_URL, hash);
        }
      }
    },
    children
  );
}

/** Display name for a block param's type: the referenced component's own
 * name when available, the yield key for local components, otherwise the
 * raw type string. */
function displayTypeName(param: BlockParam, data?: EmberMeta): string {
  if (param.componentRef?.local) return param.name;

  return (data ? componentDisplayName(param.componentRef, data) : undefined) ?? param.type;
}

function isBlockParam(param: BlockParam | HashBlockParam): param is BlockParam {
  return Object.hasOwn(param, 'name') && Object.hasOwn(param, 'type');
}

type MemberEntry = [name: string, param: BlockParam];

function isNamedParam(name: string): boolean {
  return Boolean(name) && !name.startsWith('param');
}

/**
 * A `BlockParam` whose type was unfolded from a named non-component type is
 * an object just like an inline yield hash — normalize its members to
 * `[name, param]` entries. `undefined` for scalar params.
 */
function memberEntriesOf(param: BlockParam): MemberEntry[] | undefined {
  const nested = param.nested;

  if (!nested || nested.length === 0) return undefined;

  return nested.flatMap((entry): MemberEntry[] =>
    isBlockParam(entry) ? [[entry.name, entry]] : Object.entries(entry)
  );
}

function renderTypeValue(
  param: BlockParam,
  subcomponentNames: Set<string>,
  data?: EmberMeta
): ReactNode {
  const displayType = displayTypeName(param, data);

  return subcomponentNames.has(displayType)
    ? createElement(SubcomponentAnchor, { key: 'type', name: displayType }, displayType)
    : createElement(ParamType, { key: 'type' }, displayType);
}

function descLine(param: BlockParam, key: string, depth?: number): ReactNode | undefined {
  if (!param.description) return undefined;

  const style = depth === undefined ? undefined : { marginBottom: 0, marginLeft: depth * 20 + 10 };

  return createElement(ParamDesc, { key, style }, param.description);
}

function codeLine(key: string, depth: number, children: ReactNode[]): ReactNode {
  return createElement(CodeLine, { key, style: { paddingInlineStart: depth * 20 } }, ...children);
}

/**
 * Render an object param JSON-style: an opening brace line (optionally
 * prefixed `name: `), member lines one level deeper, and a closing brace —
 * no dashes, no blank lines between the object's lines. Object members
 * recurse; scalar members render as `name: type`.
 */
function renderParamBlock(
  name: string | undefined,
  entries: MemberEntry[],
  subcomponentNames: Set<string>,
  data: EmberMeta | undefined,
  depth: number,
  key: string
): ReactNode[] {
  const head: ReactNode[] = name ? [createElement(ParamName, { key: `${key}-n` }, name), ': '] : [];

  const lines = [codeLine(`${key}-o`, depth, [...head, '{'])];

  for (const [i, [memberName, memberParam]] of entries.entries()) {
    const memberKey = `${key}-${i}`;
    const memberEntries = memberEntriesOf(memberParam);

    if (memberEntries) {
      lines.push(
        ...renderParamBlock(
          memberName,
          memberEntries,
          subcomponentNames,
          data,
          depth + 1,
          memberKey
        )
      );
    } else {
      lines.push(
        codeLine(`${memberKey}-l`, depth + 1, [
          createElement(ParamName, { key: `${memberKey}-n` }, memberName),
          ': ',
          renderTypeValue(memberParam, subcomponentNames, data)
        ])
      );
    }

    const desc = descLine(memberParam, `${memberKey}-d`, depth + 1);

    if (desc) lines.push(desc);
  }

  lines.push(codeLine(`${key}-x`, depth, ['}']));

  return lines;
}

function renderParams(
  params: BlockInfo['params'],
  subcomponentNames: Set<string>,
  data?: EmberMeta,
  keyPrefix = 'p'
): ReactNode[] {
  return params.flatMap((param, i) => {
    const key = `${keyPrefix}-${i}`;

    if (!isBlockParam(param)) {
      // Inline yield hash — an object, never a dashed list item.
      return renderParamBlock(undefined, Object.entries(param), subcomponentNames, data, 0, key);
    }

    const entries = memberEntriesOf(param);

    if (entries) {
      // A named non-component type unfolded into its members — an object.
      const name = isNamedParam(param.name) ? param.name : undefined;
      const lines = renderParamBlock(name, entries, subcomponentNames, data, 0, key);
      const desc = descLine(param, `${key}-d`, 0);

      if (desc) lines.push(desc);

      return lines;
    }

    // Positional param — a list item with a dash.
    const type = renderTypeValue(param, subcomponentNames, data);
    const children: ReactNode[] = isNamedParam(param.name)
      ? ['- ', createElement(ParamName, { key: 'name' }, param.name), ': ', type]
      : ['- ', type];

    const rows: ReactNode[] = [createElement(ParamRow, { key: 'row' }, ...children)];
    const desc = descLine(param, 'desc');

    if (desc) rows.push(desc);

    return createElement(Fragment, { key }, ...rows);
  });
}

export function BlocksTable({
  blocks,
  subcomponentNames,
  data
}: {
  blocks: Record<string, BlockInfo>;
  subcomponentNames: Set<string>;
  data?: EmberMeta;
}) {
  const entries = Object.entries(blocks).toSorted(([nameA, _a], [nameB, _b]) => {
    if (nameA === 'default') return -1;
    if (nameB === 'default') return -1;

    return 0;
  });

  if (entries.length === 0) return;

  const rows = [];

  for (const [name, block] of entries) {
    const displayName = `<:${name}>`;

    rows.push(
      createElement('tr', { key: name }, createElement(BlocksNameCell, undefined, displayName))
    );

    if (block.params.length > 0) {
      const params = renderParams(block.params, subcomponentNames, data);

      rows.push(
        createElement('tr', { key: `${name}-params` }, createElement('td', undefined, ...params))
      );
    }
  }

  return createElement(
    TableWrapper,
    { className: 'docblock-argstable sb-unstyled' },
    createElement('tbody', { className: 'docblock-argstable-body' }, rows)
  );
}

export function BlocksSection({
  blocks,
  subcomponentNames,
  data
}: {
  blocks: Record<string, BlockInfo>;
  subcomponentNames: Set<string>;
  data?: EmberMeta;
}) {
  return createElement(
    BlocksDiv,
    undefined,
    createElement(Subheading, undefined, 'Blocks'),
    BlocksTable({ blocks, subcomponentNames, data })
  );
}
