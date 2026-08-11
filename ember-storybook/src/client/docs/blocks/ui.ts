/* eslint-disable unicorn/no-null */
import { Heading } from '@storybook/addon-docs/blocks';
import { createElement } from 'react';
import { styled, type Theme } from 'storybook/theming';

export interface Entry {
  name: string;
  description?: string;
}

type StyleProps = { theme: Theme };

export function isHtmlElement(name: string): boolean {
  return /^HTML[A-Z]\w*Element$/.test(name);
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const TableWrapper = styled.table(({ theme }: StyleProps) => ({
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
    color: theme.textMutedColor as string,
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

export function renderHead(columns: string[]) {
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

export function renderBody(entries: Entry[]) {
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

export const H2 = styled(Heading)(({ theme }) => ({
  fontSize: `${theme.typography.size.s2 - 1}px`,
  fontWeight: theme.typography.weight.bold,
  lineHeight: '16px',
  letterSpacing: '0.35em',
  textTransform: 'uppercase',
  color: theme.textMutedColor as string,
  border: 0,
  marginBottom: '12px',
  '&:first-of-type': { marginTop: '56px' }
}));
