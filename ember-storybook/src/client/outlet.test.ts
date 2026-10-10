import { beforeEach, describe, expect, test, vi } from 'vitest';

import { OUTLET_GLOBAL_KEY } from '../outlet-key';
import {
  buildRouteOutletState,
  outletRootSupported,
  resolveOutletStub,
  templateUsesOutlet
} from './outlet';

import type { RouteParameters } from './types';
import type { ComponentLike } from '@glint/template';

// `outlet.ts` also hosts the Ember-side outlet mounting, whose top-level
// `@ember/*` imports do not resolve under node. The functions tested here are
// pure; stub the effectful edge so the module can load. (Vitest hoists these
// above the imports.)
vi.mock('@ember/renderer', () => ({ renderSettled: () => Promise.resolve() }));
vi.mock('@ember/runloop', () => ({ run: (callback: () => void) => callback() }));

// `resolveOutletStub` curries the outlet content with the public `template()`
// API; back it with a spy that hands out an identity object per call and
// records the (source, options) pair.
const { templateSpy } = vi.hoisted(() => ({
  templateSpy: vi.fn((source: string, _options: unknown) => ({ tag: 'invoker', source }))
}));

vi.mock('@ember/template-compiler', () => ({ template: templateSpy }));

// `templateUsesOutlet` reaches the story component's template through
// `getComponentTemplate`; back it with a registry the tests fill per component.
const { templateRegistry } = vi.hoisted(() => ({
  templateRegistry: new WeakMap<object, unknown>()
}));

vi.mock('@ember/component', () => ({
  getComponentTemplate: (component: object) => templateRegistry.get(component)
}));

// Glint's `ComponentLike` is an invokable (call/construct) shape; runtime-only
// test fixtures carry their identity in a `tag` property.
function fakeComponent(tag: string): ComponentLike {
  return Object.assign(() => tag, { tag }) as unknown as ComponentLike;
}

const routeTemplate = { tag: 'route-template' };
const owner = { factory: 'owner' };
const placeholder = fakeComponent('placeholder');

function input(overrides: Partial<Parameters<typeof buildRouteOutletState>[0]> = {}) {
  return {
    template: routeTemplate,
    route: {} as RouteParameters,
    args: {},
    storyName: 'My Story',
    owner,
    ...overrides
  };
}

/** The scope object of the last `template()` call, for invoker assertions. */
function lastInvokerScope(): Record<string, unknown> {
  const call = templateSpy.mock.calls.at(-1);

  if (!call) {
    throw new Error('expected `template()` to have been called');
  }

  const [, options] = call;

  return (options as { scope(): Record<string, unknown> }).scope();
}

describe('OUTLET_GLOBAL_KEY', () => {
  test('names the toolbar global the preview reads', () => {
    expect(OUTLET_GLOBAL_KEY).toBe('outlet');
  });
});

describe('resolveOutletStub', () => {
  beforeEach(() => {
    templateSpy.mockClear();
  });

  test('a string labels the placeholder', async () => {
    const load = vi.fn(() => Promise.resolve(placeholder));

    expect(
      await resolveOutletStub({ route: { outlet: 'settings' }, mode: 'hole', placeholder: load })
    ).toBe(templateSpy.mock.results[0].value);
    expect(load).toHaveBeenCalledOnce();
    // eslint-disable-next-line unicorn/no-null -- the wire-format hole, curried into the invoker
    expect(lastInvokerScope()).toEqual({ Stub: placeholder, model: 'settings', hole: null });
  });

  test('a ComponentLike is the outlet content as given', async () => {
    const stubComponent = fakeComponent('explicit');
    const load = vi.fn();

    expect(
      await resolveOutletStub({
        route: { outlet: stubComponent },
        mode: 'placeholder',
        placeholder: load
      })
    ).toBe(templateSpy.mock.results[0].value);
    // An explicit outlet wins over the global without touching the placeholder.
    expect(load).not.toHaveBeenCalled();
    // eslint-disable-next-line unicorn/no-null -- the wire-format hole, curried into the invoker
    expect(lastInvokerScope()).toEqual({ Stub: stubComponent, model: undefined, hole: null });
  });

  test('template-only components are objects, not functions — still a component', async () => {
    // ember's `templateOnly()` (and what app builds compile inline `<template>`
    // expressions to) is a plain object carrying only debug metadata.
    const toc = { moduleName: 'app/templates/child', name: '(unknown template-only component)' };

    expect(
      await resolveOutletStub({ route: { outlet: toc as never }, placeholder: () => placeholder })
    ).toBe(templateSpy.mock.results[0].value);
    expect(lastInvokerScope().Stub).toBe(toc);
  });

  test('the invoker template never spells the bare outlet/mount keyword paths', async () => {
    await resolveOutletStub({ route: { outlet: 'm' }, placeholder: () => placeholder });

    const [source] = templateSpy.mock.calls[0];

    // `{{outlet}}`/`{{mount}}` are rewritten by ember's template transforms on
    // every build; the free-variable names must dodge both keyword spellings.
    expect(source).not.toMatch(/\{\{\s*(outlet|mount)\s*\}\}/);
    expect(source).toContain('<Stub');
  });

  test('mode "placeholder" resolves the placeholder lazily, unlabeled', async () => {
    const load = vi.fn(() => placeholder);

    expect(await resolveOutletStub({ route: {}, mode: 'placeholder', placeholder: load })).toBe(
      templateSpy.mock.results[0].value
    );
    expect(load).toHaveBeenCalledOnce();
    // eslint-disable-next-line unicorn/no-null -- the wire-format hole, curried into the invoker
    expect(lastInvokerScope()).toEqual({ Stub: placeholder, model: undefined, hole: null });
  });

  test('mode "hole" is a hole without touching the placeholder', async () => {
    const load = vi.fn();

    expect(await resolveOutletStub({ route: {}, mode: 'hole', placeholder: load })).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect(templateSpy).not.toHaveBeenCalled();
  });

  test('an unset global (undefined mode) defaults to a hole', async () => {
    expect(await resolveOutletStub({ route: {}, placeholder: () => placeholder })).toBeNull();
  });

  test('any other global value is treated as a hole', async () => {
    expect(
      await resolveOutletStub({ route: {}, mode: 'bogus' as never, placeholder: () => placeholder })
    ).toBeNull();
  });

  test('the retired stub-bag shape fails with an actionable message', async () => {
    await expect(
      resolveOutletStub({
        // The `{ name, template, model }` bag of ember-storybook < 0.5.
        route: { outlet: { template: placeholder, model: 'x' } as never },
        placeholder: () => placeholder
      })
    ).rejects.toThrow(/must be a string \(the placeholder label\) or a component/);
  });

  test('null is not a component and fails like the retired bag', async () => {
    await expect(
      // eslint-disable-next-line unicorn/no-null -- asserting the guard rejects null
      resolveOutletStub({ route: { outlet: null as never }, placeholder: () => placeholder })
    ).rejects.toThrow(/must be a string/);
  });
});

describe('buildRouteOutletState', () => {
  test('renders the route template itself with story-level defaults', () => {
    const state = buildRouteOutletState(input({ args: { model: 'a', controller: 'b' } }));

    expect(state.render).toEqual({
      owner,
      name: 'My Story',
      template: routeTemplate,
      model: 'a',
      controller: 'b'
    });
    // No outlet content => `{{outlet}}` is a hole.
    expect(state.outlets.main).toBeUndefined();
  });

  test('route parameters override the story name and args', () => {
    const state = buildRouteOutletState(
      input({
        route: { name: 'outer', model: 'route-model', controller: 'route-ctrl' },
        args: { model: 'arg-model', controller: 'arg-ctrl' },
        storyName: 'Ignored'
      })
    );

    expect(state.render.name).toBe('outer');
    expect(state.render.model).toBe('route-model');
    expect(state.render.controller).toBe('route-ctrl');
  });

  test('an explicit undefined falls back through route to args, not blindly', () => {
    const state = buildRouteOutletState(
      input({ route: { model: undefined }, args: { model: 'arg-model' } })
    );

    expect(state.render.model).toBe('arg-model');
  });

  test('a resolved outlet renders as the main child; its label is curried in', () => {
    const curried = fakeComponent('curried');
    const state = buildRouteOutletState(input({ outlet: curried }));

    expect(state.outlets.main?.render).toEqual({
      owner,
      name: 'outlet',
      template: curried,
      // The `@model` lives in the curried component, not the state chain.
      model: undefined,
      controller: undefined
    });
  });

  test('a null outlet (the hole) yields no child state', () => {
    // eslint-disable-next-line unicorn/no-null -- null is the resolved hole value
    const state = buildRouteOutletState(input({ outlet: null }));

    expect(state.outlets.main).toBeUndefined();
  });

  test('stubbing is one level deep: the child gets no outlet of its own', () => {
    const state = buildRouteOutletState(input({ outlet: fakeComponent('curried') }));

    expect(state.outlets.main?.outlets.main).toBeUndefined();
  });
});

describe('outletRootSupported', () => {
  test('true when the container still has a view:-outlet factory', () => {
    const classic = { factoryFor: (name: string) => (name === 'view:-outlet' ? {} : undefined) };

    expect(outletRootSupported(classic)).toBe(true);
  });

  test('false when the build dropped it (ember-source >= 7.5.0-alpha.2)', () => {
    const rfc1099 = { factoryFor: vi.fn() };

    expect(outletRootSupported(rfc1099)).toBe(false);
  });
});

// A fake template factory: a callable that hands out the ownerless template
// whose `parsedLayout.block` is the given wire-format tuple
// `[statements, locals, upvars]`, as ember's `templateFactory` does.
function compiledFactory(block: unknown) {
  return vi.fn((_owner?: unknown) => ({ parsedLayout: { block } }));
}

// Classic compiler: `{{outlet}}` became `{{component (-outlet)}}`, so the
// keyword is a free name in `upvars`.
const classicOutletBlock = [
  [[10, 'div'], [46, [28, [31, 2], undefined, undefined], undefined, undefined, undefined], [13]],
  ['@model'],
  ['if', 'component', '-outlet']
];

// RFC 1099 compiler (ember-source >= 7.5.0-alpha.2): `{{outlet}}` became
// `<@outlet />` — verbatim the block of ember-source's own top-level
// `OutletTemplate`, with `@outlet` among the template's argument slots.
// eslint-disable-next-line unicorn/no-null -- verbatim wire fixture: empty slots are null
const rfc1099OutletBlock = [[[8, [30, 1], null, null, null]], ['@outlet'], []];

describe('templateUsesOutlet', () => {
  test('detects the -outlet keyword in the template upvars (classic)', () => {
    const component = {};

    templateRegistry.set(component, compiledFactory(classicOutletBlock));

    expect(templateUsesOutlet(component)).toBe(true);
  });

  test('detects the @outlet argument in the template locals (RFC 1099)', () => {
    const component = {};

    templateRegistry.set(component, compiledFactory(rfc1099OutletBlock));

    expect(templateUsesOutlet(component)).toBe(true);
  });

  test('asks the factory for the ownerless template', () => {
    const component = {};
    const factory = compiledFactory(classicOutletBlock);

    templateRegistry.set(component, factory);

    templateUsesOutlet(component);

    expect(factory.mock.calls[0][0]).toBeUndefined();
  });

  test('a template without the outlet keyword is not a route story', () => {
    const plainComponent = {};
    const plainBlock = [[[10, 'div'], [1, 'hello'], [13]], [], ['if']];

    templateRegistry.set(plainComponent, compiledFactory(plainBlock));

    expect(templateUsesOutlet(plainComponent)).toBe(false);
  });

  test('an "-outlet" string literal in the statements is not an outlet', () => {
    const literalComponent = {};
    const literalBlock = [[[1, '-outlet']], [], ['concat']];

    templateRegistry.set(literalComponent, compiledFactory(literalBlock));

    expect(templateUsesOutlet(literalComponent)).toBe(false);
  });

  test('an "@outlet" string literal in the statements is not an outlet', () => {
    const literalComponent = {};
    const literalBlock = [[[1, '@outlet']], [], []];

    templateRegistry.set(literalComponent, compiledFactory(literalBlock));

    expect(templateUsesOutlet(literalComponent)).toBe(false);
  });

  test('a raw template factory used as the component is recognized', () => {
    const factory = Object.assign(compiledFactory(classicOutletBlock), {
      __meta: { moduleName: 'app/templates/some-route' }
    });

    expect(templateUsesOutlet(factory)).toBe(true);
  });

  test('a component without any template is not a route story', () => {
    expect(templateUsesOutlet({ template: 'not registered' })).toBe(false);
    expect(templateUsesOutlet(() => false)).toBe(false);
  });

  test('degrades to false for template shapes it does not understand', () => {
    const cases: unknown[] = [
      // factory that hands out no template data
      () => false,
      // a compile-error template
      () => ({ result: 'error' }),
      // no parsed layout
      () => ({}),
      // block without an args or upvars slot
      () => ({ parsedLayout: { block: [[]] } }),
      // block without an upvars slot
      () => ({ parsedLayout: { block: [[], ['@model']] } }),
      // block that was never parsed from its JSON string
      () => ({ parsedLayout: { block: 'not parsed yet' } })
    ];

    for (const factory of cases) {
      const routeLike = {};

      templateRegistry.set(routeLike, factory);

      expect(templateUsesOutlet(routeLike)).toBe(false);
    }
  });
});
