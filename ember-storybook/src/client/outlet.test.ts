import { describe, expect, test, vi } from 'vitest';

import { buildRouteOutletState, OUTLET_GLOBAL_KEY, resolveOutletStub } from './outlet';

import type { OutletStub, RouteParameters } from './types';

// `outlet.ts` also hosts the Ember-side outlet mounting, whose top-level
// `@ember/*` imports do not resolve under node. The functions tested here are
// pure; stub the effectful edge so the module can load. (Vitest hoists these
// above the imports.)
vi.mock('@ember/renderer', () => ({ renderSettled: () => Promise.resolve() }));
vi.mock('@ember/runloop', () => ({ run: (callback: () => void) => callback() }));

const template = { tag: 'template' };
const owner = { factory: 'owner' };

const placeholderStub: OutletStub = {
  name: 'outer/index',
  template: { tag: 'placeholder' },
  model: { id: 1 },
  controller: { name: 'ctrl' }
};

function input(overrides: Partial<Parameters<typeof buildRouteOutletState>[0]> = {}) {
  return {
    template,
    route: {} as RouteParameters,
    args: {},
    storyName: 'My Story',
    owner,
    ...overrides
  };
}

describe('OUTLET_GLOBAL_KEY', () => {
  test('names the toolbar global the preview reads', () => {
    expect(OUTLET_GLOBAL_KEY).toBe('outlet');
  });
});

describe('resolveOutletStub', () => {
  test('an explicit route.outlet stub always wins over the global', async () => {
    const route: RouteParameters = { outlet: { template: { tag: 'explicit' } } };

    expect(await resolveOutletStub({ route, mode: 'hole', placeholder: vi.fn() })).toBe(
      route.outlet
    );
  });

  test('a route.outlet without a template is not an intent to render, and falls through to the mode', async () => {
    const placeholder = vi.fn(() => Promise.resolve(placeholderStub));

    expect(
      await resolveOutletStub({
        route: { outlet: { name: 'x' } },
        mode: 'placeholder',
        placeholder
      })
    ).toBe(placeholderStub);
    expect(placeholder).toHaveBeenCalledOnce();
  });

  test('mode "placeholder" resolves the stub lazily produced by the callback', async () => {
    const placeholder = vi.fn(() => Promise.resolve(placeholderStub));

    expect(await resolveOutletStub({ route: {}, mode: 'placeholder', placeholder })).toBe(
      placeholderStub
    );
    expect(placeholder).toHaveBeenCalledOnce();
  });

  test('mode "hole" leaves a hole without touching the placeholder', async () => {
    const placeholder = vi.fn();

    expect(await resolveOutletStub({ route: {}, mode: 'hole', placeholder })).toBeUndefined();
    expect(placeholder).not.toHaveBeenCalled();
  });

  test('an unset global (undefined mode) defaults to a hole', async () => {
    const placeholder = vi.fn();

    expect(await resolveOutletStub({ route: {}, placeholder })).toBeUndefined();
    expect(placeholder).not.toHaveBeenCalled();
  });

  test('any other value is treated as a hole', async () => {
    expect(
      await resolveOutletStub({
        route: {},
        mode: 'bogus' as never,
        placeholder: () => placeholderStub
      })
    ).toBeUndefined();
  });

  test('accepts a synchronous placeholder producer', async () => {
    expect(
      await resolveOutletStub({
        route: {},
        mode: 'placeholder',
        placeholder: () => placeholderStub
      })
    ).toBe(placeholderStub);
  });
});

describe('buildRouteOutletState', () => {
  test('renders the route template itself with story-level defaults', () => {
    const state = buildRouteOutletState(input({ args: { model: 'a', controller: 'b' } }));

    expect(state.render).toEqual({
      owner,
      name: 'My Story',
      template,
      model: 'a',
      controller: 'b'
    });
    // No outlet stub => `{{outlet}}` is a hole.
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

  test('a stubbed outlet renders as the main child with the stub template', () => {
    const state = buildRouteOutletState(input({ outlet: placeholderStub }));

    expect(state.outlets.main?.render).toEqual({
      owner,
      name: placeholderStub.name,
      template: placeholderStub.template,
      model: placeholderStub.model,
      controller: placeholderStub.controller
    });
  });

  test('a stub without a name surfaces as "outlet"', () => {
    const state = buildRouteOutletState(input({ outlet: { template: placeholderStub.template } }));

    expect(state.outlets.main?.render.name).toBe('outlet');
  });

  test('stubbing is one level deep: the child gets no outlet of its own', () => {
    const state = buildRouteOutletState(input({ outlet: placeholderStub }));

    expect(state.outlets.main?.outlets.main).toBeUndefined();
  });
});
