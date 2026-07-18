/* eslint-disable unicorn/no-null */
import { Heading } from '@storybook/addon-docs/blocks';
import { createElement, Fragment, type ReactNode } from 'react';
import { styled, type Theme } from 'storybook/theming';

import type { BlockInfo, ComponentSignature } from '../../node/typedoc/types';

interface Entry {
  name: string;
  description?: string;
}

type StyleProps = { theme: Theme };

const TableWrapper = styled.table(({ theme }: StyleProps) => ({
  fontFamily: theme.typography.fonts.base,
  borderSpacing: 0,
  color: theme.color.defaultText,
  fontSize: theme.typography.size.s2 - 1,
  lineHeight: '19px',
  textAlign: 'left',
  width: '100%',
  marginTop: 25,
  marginBottom: 40,
  marginInline: 1,
  'td, th': {
    padding: 0,
    border: 'none',
    verticalAlign: 'top',
    textOverflow: 'ellipsis'
  },
  'th:first-of-type, td:first-of-type': {
    paddingLeft: 20
  },
  'th:last-of-type, td:last-of-type': {
    paddingRight: 20
  },
  th: {
    color: theme.textMutedColor,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 15,
    paddingRight: 15
  },
  td: {
    paddingTop: '10px',
    paddingBottom: '10px',
    '&:not(:first-of-type)': {
      paddingLeft: 15,
      paddingRight: 15
    },
    '&:last-of-type': {
      paddingRight: 20
    }
  },
  tbody: {
    filter:
      theme.base === 'light'
        ? 'drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.10))'
        : 'drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.20))',
    '> tr > *': {
      background: theme.background.content,
      borderTop: `1px solid ${theme.appBorderColor}`
    },
    '> tr:first-of-type > *': {
      borderBlockStart: `1px solid ${theme.appBorderColor}`
    },
    '> tr:last-of-type > *': {
      borderBlockEnd: `1px solid ${theme.appBorderColor}`
    },
    '> tr > *:first-of-type': {
      borderInlineStart: `1px solid ${theme.appBorderColor}`
    },
    '> tr > *:last-of-type': {
      borderInlineEnd: `1px solid ${theme.appBorderColor}`
    },
    '> tr:first-of-type > td:first-of-type': {
      borderTopLeftRadius: theme.appBorderRadius
    },
    '> tr:first-of-type > td:last-of-type': {
      borderTopRightRadius: theme.appBorderRadius
    },
    '> tr:last-of-type > td:first-of-type': {
      borderBottomLeftRadius: theme.appBorderRadius
    },
    '> tr:last-of-type > td:last-of-type': {
      borderBottomRightRadius: theme.appBorderRadius
    }
  },
  '@media (forced-colors: active)': {
    tbody: {
      filter: 'none',
      '> tr > *': {
        borderColor: 'CanvasText'
      }
    }
  }
}));

function renderHead(columns: string[]) {
  return createElement(
    'thead',
    { className: 'docblock-argstable-head' },
    createElement(
      'tr',
      null,
      ...columns.map((col) => createElement('th', null, createElement('span', null, col)))
    )
  );
}

function renderBody(entries: Entry[]) {
  return createElement(
    'tbody',
    { className: 'docblock-argstable-body' },
    ...entries.map((entry) =>
      createElement(
        'tr',
        { key: entry.name },
        createElement(
          'td',
          null,
          createElement('span', { style: { fontWeight: 'bold' } }, entry.name)
        ),
        createElement('td', null, entry.description ?? '')
      )
    )
  );
}

function renderPartsBody(entries: Entry[]) {
  return createElement(
    'tbody',
    { className: 'docblock-argstable-body' },
    ...entries.map((entry) =>
      createElement(
        'tr',
        { key: entry.name },
        createElement(
          'td',
          null,
          createElement(
            'code',
            { style: { fontSize: 12, fontWeight: 'bold' } },
            `[part="${entry.name}"]`
          )
        ),
        createElement('td', null, entry.description ?? '')
      )
    )
  );
}

export function PartsTable({ entries }: { entries: Entry[] }) {
  return createElement(
    TableWrapper,
    { className: 'docblock-argstable sb-unstyled' },
    renderHead(['Part', 'Description']),
    renderPartsBody(entries)
  );
}

export function CssPropertiesTable({ entries }: { entries: Entry[] }) {
  return createElement(
    TableWrapper,
    { className: 'docblock-argstable sb-unstyled' },
    renderHead(['Property', 'Value']),
    renderBody(entries)
  );
}

export const StoriesHeading = styled(Heading)(({ theme }) => ({
  fontSize: `${theme.typography.size.s2 - 1}px`,
  fontWeight: theme.typography.weight.bold,
  lineHeight: '16px',
  letterSpacing: '0.35em',
  textTransform: 'uppercase',
  color: theme.textMutedColor,
  border: 0,
  marginBottom: '12px',
  '&:first-of-type': { marginTop: '56px' }
}));

// ── Subcomponent ref type ───────────────────────────────────

export interface SubcomponentRef {
  badge: number;
  key: string;
  name: string;
  signature: ComponentSignature;
  hasStory: boolean;
}

// ── Blocks table ──────────────────────────────────────────────

const BlocksSection = styled.div(({ theme }) => ({
  marginTop: 25,
  marginBottom: 40
}));

const BlockEntry = styled.div(({ theme }) => ({
  marginBottom: 24,
  '&:last-child': { marginBottom: 0 }
}));

const BlockName = styled.div(({ theme }) => ({
  color: theme.color.primary,
  fontWeight: 'bold',
  fontSize: theme.typography.size.s2 - 1,
  marginBottom: 4
}));

const BlockDescription = styled.div(({ theme }) => ({
  color: theme.color.defaultText,
  fontSize: theme.typography.size.s1,
  lineHeight: '19px',
  marginBottom: 8
}));

const ParamRow = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2 - 1,
  lineHeight: '19px',
  marginBottom: 2
}));

const ParamDesc = styled.div(({ theme }) => ({
  color: theme.textMutedColor,
  fontSize: theme.typography.size.s1,
  lineHeight: '17px',
  marginBottom: 8,
  marginLeft: 20
}));

const ParamName = styled.span(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.color.defaultText
}));

const ParamType = styled.code(({ theme }) => ({
  color: theme.color.secondary,
  fontSize: 12,
  fontWeight: 'bold'
}));

const ParamBadge = styled.a(({ theme }) => ({
  color: theme.color.primary,
  fontWeight: 'bold',
  cursor: 'pointer',
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' }
}));

const NoParams = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
  fontStyle: 'italic'
}));

function findBadge(
  componentRef: undefined | { filePath: string; exportName: string },
  refs: SubcomponentRef[]
): number | undefined {
  if (!componentRef) return undefined;

  const key = `${componentRef.filePath}:${componentRef.exportName}`;

  return refs.find((r) => r.key === key)?.badge;
}

function renderParams(params: BlockInfo['params'], refs: SubcomponentRef[]): ReactNode[] {
  if (params.length === 0) {
    return [createElement(NoParams, { key: 'none' }, '(none)')];
  }

  return params.map((param, i) => {
    const isNamed = param.name && !param.name.startsWith('param');
    const badge = findBadge(param.componentRef, refs);
    const children: ReactNode[] = [];

    if (isNamed) {
      const typeChildren: ReactNode[] = [createElement(ParamType, { key: 'type' }, param.type)];

      if (badge !== undefined) {
        typeChildren.push(
          createElement(ParamBadge, { key: 'badge', href: '#subcomponents' }, ` ${badge}`)
        );
      }

      children.push(
        createElement('span', { key: 'sep' }, '- '),
        createElement(ParamName, { key: 'name' }, param.name),
        createElement('span', { key: 'colon' }, ': '),
        ...typeChildren
      );
    } else {
      const typeChildren: ReactNode[] = [createElement(ParamType, { key: 'type' }, param.type)];

      if (badge !== undefined) {
        typeChildren.push(
          createElement(ParamBadge, { key: 'badge', href: '#subcomponents' }, ` ${badge}`)
        );
      }

      children.push(createElement('span', { key: 'sep' }, '- '), ...typeChildren);
    }

    const rows: ReactNode[] = [createElement(ParamRow, { key: 'row' }, ...children)];

    if (param.description) {
      rows.push(createElement(ParamDesc, { key: 'desc' }, param.description));
    }

    return createElement(Fragment, { key: i }, ...rows);
  });
}

export function BlocksTable({
  blocks,
  subcomponentRefs
}: {
  blocks: Record<string, BlockInfo>;
  subcomponentRefs: SubcomponentRef[];
}) {
  const entries = Object.entries(blocks);

  if (entries.length === 0) return;

  const blockChildren = entries.map(([name, block]) =>
    createElement(
      BlockEntry,
      { key: name },
      createElement(BlockName, undefined, name),
      block.description && createElement(BlockDescription, undefined, block.description),
      ...renderParams(block.params, subcomponentRefs)
    )
  );

  return createElement(
    BlocksSection,
    undefined,
    createElement(StoriesHeading, undefined, 'Blocks'),
    ...blockChildren
  );
}

// ── Subcomponents section ──────────────────────────────────────

const SubcomponentsSection = styled.div(({ theme }) => ({
  marginTop: 25,
  marginBottom: 40
}));

const SubEntry = styled.div(({ theme }) => ({
  marginBottom: 24,
  '&:last-child': { marginBottom: 0 }
}));

const SubName = styled.div(({ theme }) => ({
  color: theme.color.primary,
  fontWeight: 'bold',
  fontSize: theme.typography.size.s2 - 1,
  marginBottom: 12
}));

const SectionLabel = styled.div(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.color.defaultText,
  fontSize: theme.typography.size.s2 - 1,
  marginBottom: 8
}));

function renderSubcomponentSignature(
  sig: ComponentSignature,
  refs: SubcomponentRef[]
): ReactNode[] {
  const children: ReactNode[] = [];

  if (sig.element) {
    children.push(
      createElement(SectionLabel, { key: 'el-label' }, 'Element'),
      createElement(
        ParamRow,
        { key: 'el-type', style: { marginBottom: 12 } },
        createElement(ParamType, undefined, sig.element)
      )
    );
  }

  if (Object.keys(sig.args).length > 0) {
    children.push(
      createElement(SectionLabel, { key: 'args-label' }, 'Args'),
      ...Object.entries(sig.args).map(([name, arg]) =>
        createElement(
          Fragment,
          { key: name },
          createElement(
            ParamRow,
            undefined,
            createElement('span', undefined, '- '),
            createElement(ParamName, undefined, name),
            createElement('span', undefined, ': '),
            createElement(ParamType, undefined, arg.type)
          ),
          arg.description && createElement(ParamDesc, undefined, arg.description)
        )
      )
    );
  }

  if (Object.keys(sig.blocks).length > 0) {
    children.push(
      createElement(SectionLabel, { key: 'blocks-label', style: { marginTop: 12 } }, 'Blocks'),
      ...Object.entries(sig.blocks).map(([name, block]) =>
        createElement(
          BlockEntry,
          { key: name },
          createElement(BlockName, undefined, name),
          block.description && createElement(BlockDescription, undefined, block.description),
          ...renderParams(block.params, refs)
        )
      )
    );
  }

  return children;
}

export function SubcomponentsArea({ components }: { components: SubcomponentRef[] }) {
  if (components.length === 0) return;

  const entries = components.map((comp) => {
    const subRefs = components.filter((r) => r.key !== comp.key);

    return createElement(
      SubEntry,
      { key: comp.key },
      createElement(
        SubName,
        undefined,
        createElement('span', undefined, `${comp.name} `),
        createElement(ParamBadge, { href: comp.hasStory ? '#' : undefined }, comp.badge)
      ),
      ...renderSubcomponentSignature(comp.signature, subRefs)
    );
  });

  return createElement(
    SubcomponentsSection,
    undefined,
    createElement(StoriesHeading, undefined, 'Subcomponents'),
    ...entries
  );
}

const ElementWrapper = styled.div(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
  color: theme.color.defaultText,
  fontSize: theme.typography.size.s2 - 1,
  lineHeight: '19px',
  marginTop: 25,
  marginBottom: 40,
  span: {
    '&:first-of-type': {
      fontWeight: 'bold',
      marginRight: 8
    }
  },
  code: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  'a code': {
    color: theme.color.secondary,
    textDecoration: 'none'
  },
  a: {
    color: theme.color.secondary,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline'
    }
  }
}));

function isHtmlElement(name: string): boolean {
  return /^HTML[A-Z]\w*Element$/.test(name);
}

export function ElementBlock({ element }: { element: string }) {
  const elements = element
    .split(' | ')
    .map((s) => s.trim())
    .filter(Boolean);

  if (elements.length === 0) return;

  const children: ReactNode[] = [createElement('span', { key: 'label' }, 'Element:')];

  for (const [i, name] of elements.entries()) {
    if (i > 0) {
      children.push(createElement('span', { key: `sep-${i}` }, ' | '));
    }

    const inner = isHtmlElement(name)
      ? createElement(
          'a',
          {
            key: `link-${name}`,
            href: `https://developer.mozilla.org/en-US/docs/Web/API/${name}`,
            target: '_blank',
            rel: 'noopener noreferrer'
          },
          name
        )
      : name;

    children.push(createElement('code', { key: name }, inner));
  }

  return createElement(ElementWrapper, undefined, ...children);
}
