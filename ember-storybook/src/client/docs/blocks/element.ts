import { createElement, type ReactNode } from 'react';
import { styled } from 'storybook/theming';

import { isHtmlElement } from './ui';

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
