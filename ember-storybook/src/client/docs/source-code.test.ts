import { describe, expect, test } from 'vitest';

import { resolveTemplateArgs } from './source-code';

describe('resolveTemplateArgs', () => {
  test('fills text with the plain value', () => {
    expect(
      resolveTemplateArgs('<Button @kind={{args.kind}}>{{args.label}} ({{args.count}})</Button>', {
        kind: 'primary',
        label: 'Save',
        count: 3
      })
    ).toBe('<Button @kind="primary">Save (3)</Button>');
  });

  test('leaves values it does not know as arguments', () => {
    expect(resolveTemplateArgs('<p title={{args.title}}>{{args.body}}</p>', {})).toBe(
      '<p title={{@title}}>{{@body}}</p>'
    );
  });
});
