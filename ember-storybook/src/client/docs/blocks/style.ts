/* eslint-disable unicorn/no-null */
import { createElement } from 'react';

import { type Entry, renderBody, renderHead, TableWrapper } from './ui';

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
