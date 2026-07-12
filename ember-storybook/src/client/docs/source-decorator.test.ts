import { describe, expect, test, vi } from 'vitest';

vi.mock('virtual:ember-storybook-meta', () => ({
  default: {
    'test--hello': {
      componentName: 'Greeting',
      inlineTemplate: '<Greeting @name={{args.name}} />'
    },
    'test--plain': { componentName: 'Button' },
    'test--many': { componentName: 'Card' },
    'test--few': { componentName: 'Test' },
    'test--noprops': { componentName: 'NoProp' },
    'test--unknown': { componentName: '(unknown template-only component)' },
    'test--actions': { componentName: 'Button' }
  }
}));

import { generateSource, resolveTemplateArgs, toArgument } from './source-decorator';

describe('toArgument', () => {
  test('formats a string value', () => {
    expect(toArgument('name', 'Alice', {})).toBe('@name="Alice"');
  });

  test('formats a number value', () => {
    expect(toArgument('count', 42, {})).toBe('@count={{42}}');
  });

  test('formats a boolean true value', () => {
    expect(toArgument('active', true, {})).toBe('@active={{true}}');
  });

  test('formats a boolean false value', () => {
    expect(toArgument('active', false, {})).toBe('@active={{false}}');
  });

  test('returns undefined for null', () => {
    // eslint-disable-next-line unicorn/no-null
    expect(toArgument('x', null, {})).toBeUndefined();
  });

  test('returns undefined for undefined', () => {
    expect(toArgument('x', undefined, {})).toBeUndefined();
  });

  test('returns @key={{@key}} for function values if key is in argTypes', () => {
    expect(toArgument('push', vi.fn(), { push: { action: true } })).toBe('@push={{@push}}');
  });

  test('returns undefined for function/object values not in argTypes', () => {
    expect(toArgument('fn', vi.fn(), {})).toBeUndefined();
    expect(toArgument('obj', { foo: 1 }, {})).toBeUndefined();
  });

  test('returns @key={{@key}} for undefined values if key is in argTypes', () => {
    expect(toArgument('user', undefined, { user: {} })).toBe('@user={{@user}}');
  });
});

describe('resolveTemplateArgs', () => {
  test('replaces string args with JSON strings', () => {
    const result = resolveTemplateArgs('<Greeting @name={{args.name}} />', {
      name: 'Alice'
    });

    expect(result).toBe('<Greeting @name="Alice" />');
  });

  test('replaces number args with mustache interpolation', () => {
    const result = resolveTemplateArgs('<Counter @count={{args.count}} />', {
      count: 5
    });

    expect(result).toBe('<Counter @count={{5}} />');
  });

  test('replaces boolean args with mustache interpolation', () => {
    const result = resolveTemplateArgs('<Toggle @active={{args.active}} />', { active: true });

    expect(result).toBe('<Toggle @active={{true}} />');
  });

  test('replaces unresolvable {{args.key}} with {{@key}}', () => {
    const result = resolveTemplateArgs('<Greeting @name={{args.name}} @title={{args.title}} />', {
      name: 'Alice'
    });

    expect(result).toBe('<Greeting @name="Alice" @title={{@title}} />');
  });

  test('handles multiple occurrences of the same arg', () => {
    const result = resolveTemplateArgs('<X @a={{args.x}} @b={{args.x}} />', { x: 'hello' });

    expect(result).toBe('<X @a="hello" @b="hello" />');
  });
});

describe('generateSource', () => {
  test('returns resolved inline template when storyId matches meta', () => {
    const result = generateSource({}, { name: 'World' }, {}, 'test--hello');

    expect(result).toBe('<Greeting @name="World" />');
  });

  test('falls back to component-name invocation when no inline template', () => {
    const result = generateSource({}, { name: 'Alice' }, {}, 'test--plain');

    expect(result).toBe('<Button @name="Alice" />');
  });

  test('formats with many args on multiple lines', () => {
    const result = generateSource(
      {},
      { a: '1', b: '2', c: '3', d: '4' },
      { a: {}, b: {}, c: {}, d: {} },
      'test--many'
    );

    expect(result).toBe('<Card\n  @a="1"\n  @b="2"\n  @c="3"\n  @d="4"\n/>');
  });

  test('formats with 3 or fewer args on one line', () => {
    const result = generateSource({}, { a: '1', b: '2' }, { a: {}, b: {} }, 'test--few');

    expect(result).toBe('<Test @a="1" @b="2" />');
  });

  test('<Name /> when there are no args', () => {
    const result = generateSource({}, {}, {}, 'test--noprops');

    expect(result).toBe('<NoProp />');
  });

  test('returns undefined when component name is unknown', () => {
    const result = generateSource(
      { name: '(unknown template-only component)' },
      {},
      {},
      'test--unknown'
    );

    expect(result).toBeUndefined();
  });

  test('includes action args as @key={{@key}}', () => {
    const result = generateSource(
      {},
      { name: 'Alice', push: vi.fn() },
      { name: {}, push: { action: true } },
      'test--actions'
    );

    expect(result).toBe('<Button @name="Alice" @push={{@push}} />');
  });
});
