import { Subheading, useOf } from '@storybook/addon-docs/blocks';
import { createElement, Fragment, type ReactNode } from 'react';
import { styled } from 'storybook/theming';

import { TableWrapper } from './ui';

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

const Indent = styled.span(() => ({
  marginInlineStart: '20px'
}));

function renderType(param: BlockParam, subcomponentNames: Set<string>): ReactNode {
  if (param.type === 'Invokable') {
    const displayType = param.componentRef?.exportName ?? param.type;
    const typeIsSubcomponent = subcomponentNames.has(displayType);

    return typeIsSubcomponent
      ? createElement(
          SubcomponentLink,
          { key: 'type', href: `#subcomponent-${displayType}` },
          displayType
        )
      : createElement(ParamType, { key: 'type' }, displayType);
  }

  return createElement(ParamType, { key: 'type' }, param.type);
}

function renderParam(param: BlockParam, subcomponentNames: Set<string>): ReactNode[] {
  const type = renderType(param, subcomponentNames);
  const name = createElement(ParamName, { key: 'name' }, param.name);

  return [name, createElement('span', { key: 'colon' }, ': '), type];
}

function isBlockParam(param: BlockParam | HashBlockParam): param is BlockParam {
  return Object.hasOwn(param, 'name') && Object.hasOwn(param, 'type');
}

function renderParams(params: BlockInfo['params'], subcomponentNames: Set<string>): ReactNode[] {
  return params.map((param, i) => {
    if (!isBlockParam(param)) {
      const children: ReactNode[] = [
        createElement('span', { key: 'open' }, '- {'),
        createElement('br'),
        ...Object.values(param).map((p) => [
          createElement(Indent),
          renderParam(p, subcomponentNames)
        ]),
        createElement('br'),
        createElement('span', { key: 'close' }, '}')
      ];

      return createElement(Fragment, { key: i }, ...children);
    }

    const isNamed = param.name && !param.name.startsWith('param');
    const displayType = param.componentRef?.exportName ?? param.type;

    const isSubcomponent = subcomponentNames.has(displayType);

    const children: ReactNode[] = [];
    const typeChildren: ReactNode[] = [];

    if (isSubcomponent) {
      typeChildren.push(
        createElement(
          SubcomponentLink,
          { key: 'type', href: `#subcomponent-${displayType}` },
          displayType
        )
      );
    } else {
      typeChildren.push(createElement(ParamType, { key: 'type' }, displayType));
    }

    if (isNamed) {
      children.push(
        createElement('span', { key: 'sep' }, '- '),
        createElement(ParamName, { key: 'name' }, param.name),
        createElement('span', { key: 'colon' }, ': '),
        ...typeChildren
      );
    } else {
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
  subcomponentNames,
  defaultName
}: {
  blocks: Record<string, BlockInfo>;
  subcomponentNames: Set<string>;
  defaultName: string;
}) {
  const entries = Object.entries(blocks).toSorted(([nameA, _a], [nameB, _b]) => {
    if (nameA === 'default') return -1;
    if (nameB === 'default') return -1;

    return 0;
  });

  if (entries.length === 0) return;

  const rows = [];

  for (const [name, block] of entries) {
    const displayName = name === 'default' ? `<${defaultName}>` : `<:${name}>`;

    rows.push(
      createElement('tr', { key: name }, createElement(BlocksNameCell, undefined, displayName))
    );

    if (block.params.length > 0) {
      const params = renderParams(block.params, subcomponentNames);

      rows.push(createElement('tr', undefined, createElement('td', undefined, ...params)));
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
  subcomponentNames
}: {
  blocks: Record<string, BlockInfo>;
  subcomponentNames: Set<string>;
}) {
  const { preparedMeta } = useOf('meta', ['meta']);
  const componentName = preparedMeta.title;

  return createElement(
    BlocksDiv,
    undefined,
    createElement(Subheading, undefined, 'Blocks'),
    BlocksTable({ blocks, subcomponentNames, defaultName: componentName })
  );
}
