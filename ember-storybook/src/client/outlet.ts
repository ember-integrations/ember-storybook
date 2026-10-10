import { getComponentTemplate } from '@ember/component';
import { renderSettled } from '@ember/renderer';
import { run } from '@ember/runloop';
import { template } from '@ember/template-compiler';

import type { OutletMode, RouteParameters } from './types';
import type ApplicationInstance from '@ember/application/instance';
import type { ComponentLike } from '@glint/template';

/**
 * What Ember's outlet root hands a route template on the classic backend. A
 * route template is *not* a component story: it receives exactly `@model` and
 * `@controller` (`OUTLET_COMPONENT_TEMPLATE` in ember-source); its `{{outlet}}`
 * reads the child from the state chain below, not from an argument.
 */
export interface OutletRenderState {
  owner: object;
  name: string;
  controller: unknown;
  model: unknown;
  template: object;
}

/**
 * Mirrors ember-source's internal `OutletState`. The shape is structural, not
 * nominal, so a plain object is accepted by `setOutletState`; the leaf's
 * `outlets.main` is what a nested `{{outlet}}` reads.
 */
export interface OutletState {
  render: OutletRenderState;
  outlets: { main: OutletState | undefined };
}

export interface RouteStoryInput {
  /** The route template — the story's `component`. */
  template: object;
  /** `parameters.ember.route`. */
  route: RouteParameters;
  /**
   * What the outlet renders — see {@link resolveOutletStub}. `null` leaves the
   * outlet as a hole.
   */
  outlet?: ComponentLike | null;
  /** Final (decorated) story args; `model`/`controller` feed the route. */
  args: Record<string, unknown>;
  /** Story name, used when `route.name` is not given. */
  storyName: string;
  /** The booted app instance the route renders under. */
  owner: object;
}

const DEFAULT_OUTLET_NAME = 'outlet';

export interface OutletResolveInput {
  /** `parameters.ember.route` of the story being rendered. */
  route: RouteParameters;
  /** Value of the `outlet` global (see `src/outlet-key.ts`), if any. */
  mode?: OutletMode;
  /**
   * The component rendered when the global asks for a visible placeholder.
   * Called lazily (and so may be an async chunk load) and only when needed;
   * injected so this module stays free of Ember-owned template components.
   */
  placeholder: () => ComponentLike | Promise<ComponentLike>;
}

/**
 * The outlet content as a single component, exactly the shape Ember's own
 * route wrapper curries onto `@outlet`:
 *
 * - the story's `@model`-style label is bound into the component (`string`
 *   form → placeholder's label), so both backends hand it to the stub without
 *   a separate channel;
 * - `@outlet` is bound to `null`, so a `{{outlet}}` *inside* the stub renders a
 *   hole: one stub level, leaf semantics — the outlet-root backend's
 *   `outlets.main: undefined` and the RFC 1099 backend's childless route.
 *
 * Compiled with the public `template()` API rather than shipped as a `.gts`
 * module: a compiled template inside the boot chunk drags bundler shims
 * (`node:module` `createRequire`) into the browser (ADR 0006). Free-variable
 * names dodge Ember's keyword transforms — a bare `{{outlet}}`/`{{mount}}`
 * path in the source would be rewritten at compile time.
 */
function curryOutlet(component: ComponentLike, model?: unknown): ComponentLike {
  // `template()` scopes may only reference in-scope identifiers — app builds
  // pre-compile this call — so the leaf-hole value needs a name, not a literal.
  // eslint-disable-next-line unicorn/no-null -- `null` is the wire-format hole value
  const hole = null;

  return template('<Stub @model={{model}} @outlet={{hole}} />', {
    moduleName: 'ember-storybook/client/outlet-invoker',
    scope: () => ({ Stub: component, model, hole })
  }) as unknown as ComponentLike;
}

/**
 * Decides what `{{outlet}}` renders, parsing `parameters.ember.route.outlet` at
 * the boundary. Returns the component for the outlet position — curried, see
 * {@link curryOutlet} — or `null` for a hole.
 *
 * An explicit `route.outlet` is author intent and always wins, so a story stays
 * deterministic no matter how the toolbar is set:
 *
 * - a `string` labels the placeholder (`outlet: 'settings'`);
 * - a component renders in the outlet position (`outlet: MyOutlet` — classes,
 *   template-only components and inline `<template>`s; template-only ones are
 *   plain objects, so "not the retired `{ template, ... }` bag" is the runtime
 *   discriminator).
 *
 * otherwise the global decides: `placeholder` renders the injected marker,
 * anything else leaves a hole.
 */
export async function resolveOutletStub({
  route,
  mode,
  placeholder
}: OutletResolveInput): Promise<ComponentLike | null> {
  // Read it as `unknown`: `RouteParameters.outlet` constrains the shape at
  // compile time, but the retired `{ template, ... }` bag lives on in JS
  // consumers, and a named error beats a type error.
  const outlet: unknown = route.outlet;

  if (outlet === undefined) {
    if (mode === 'placeholder') {
      return curryOutlet(await placeholder());
    }

    // eslint-disable-next-line unicorn/no-null -- `null` is the wire-format hole value
    return null;
  }

  if (typeof outlet === 'string') {
    return curryOutlet(await placeholder(), outlet);
  }

  // Component definitions are functions (classes, template factories) or
  // plain objects (template-only components); the retired bag — and anything
  // else — falls through to the throw.
  if (
    typeof outlet === 'function' ||
    (typeof outlet === 'object' && outlet !== null && !('template' in outlet))
  ) {
    return curryOutlet(outlet as ComponentLike);
  }

  throw new Error(
    'ember-storybook: `parameters.ember.route.outlet` must be a string (the ' +
      `placeholder label) or a component, got ${JSON.stringify(outlet)}.`
  );
}

/**
 * The name `{{outlet}}` compiles to on classic builds: the built-in keyword
 * helper `{{component (-outlet)}}` (see ember-source's
 * `transform-wrap-mount-and-outlet`).
 */
const OUTLET_KEYWORD = '-outlet';

/**
 * The name Ember's RFC 1099 transform compiles `{{outlet}}` to instead
 * (ember-source >= 7.5.0-alpha.2): `<@outlet />`, the template's own named
 * argument.
 */
const OUTLET_ARGUMENT = '@outlet';

/**
 * The ownerless template a template factory hands out, reduced to the one
 * intimate API we read. `parsedLayout` is deliberately absent from Ember's
 * public types (ember-source keeps it "because some addons use these intimate
 * APIs"), so the shape is declared here rather than imported.
 */
interface ParsedTemplate {
  parsedLayout?: { block?: unknown };
}

/**
 * Story components are normally classes or template-only components (both
 * reachable via `getComponentTemplate`); a raw `createTemplateFactory` result
 * used directly as the component is only recognizable by its `__meta` marker.
 */
function asTemplateFactory(
  component: object
): ((owner?: unknown) => ParsedTemplate | undefined) | undefined {
  return typeof component === 'function' && '__meta' in component
    ? (component as unknown as (owner?: unknown) => ParsedTemplate | undefined)
    : undefined;
}

/**
 * Whether the component's *own* template references `{{outlet}}` — i.e. it is a
 * route template, which is how an unannotated route-story is recognized (#62).
 *
 * A template factory caches a per-owner (plus ownerless) `TemplateImpl`; its
 * `parsedLayout.block` is the parsed wire-format tuple
 * `[statements, locals, upvars]`. Which slot reveals the outlet depends on the
 * compiler that produced the template — the app's ember-source:
 *
 * - classic (`< 7.5.0-alpha.2`): the keyword `-outlet` is a free name, so
 *   every use of `{{outlet}}` — and only uses of it — lands in `upvars`;
 *   checking that slot cannot mistake a string literal `"-outlet"` used as an
 *   argument for a real outlet.
 * - RFC 1099 (`>= 7.5.0-alpha.2`): `{{outlet}}` compiles to `<@outlet />`, so
 *   `@outlet` shows up as one of the template's own arguments in `locals`.
 */
export function templateUsesOutlet(component: object): boolean {
  const factory = getComponentTemplate(component) ?? asTemplateFactory(component);

  if (!factory) {
    return false;
  }

  // Calling the factory with no owner returns the memoized ownerless template —
  // pure data: no owner, no compilation, no side effects on later owner renders.
  const compiled = (factory as unknown as (owner?: unknown) => ParsedTemplate | undefined)(
    undefined
  );
  const block = compiled?.parsedLayout?.block;

  if (!Array.isArray(block)) {
    return false;
  }

  const [, locals, upvars] = block as [unknown, unknown, unknown];

  return (
    (Array.isArray(upvars) && upvars.includes(OUTLET_KEYWORD)) ||
    (Array.isArray(locals) && locals.includes(OUTLET_ARGUMENT))
  );
}

// Ember has no named outlets any more: every `{{outlet}}` is the "main" one.
function mainOutlet(child: OutletState | undefined): OutletState['outlets'] {
  return { main: child };
}

function buildChildRenderState(component: ComponentLike, owner: object): OutletState {
  return {
    render: {
      owner,
      name: DEFAULT_OUTLET_NAME,
      template: component,
      // The stub's `@model` (placeholder label) is curried into the component
      // itself by `curryOutlet`; the outlet state hands no model of its own.
      model: undefined,
      controller: undefined
    },
    // One level only: a stubbed child route is a leaf, so a `{{outlet}}` inside
    // it renders a hole as well.
    outlets: mainOutlet(undefined)
  };
}

/**
 * Builds the `OutletState` for a route story — the outlet-root backend, used on
 * Ember builds that still have `view:-outlet` (see {@link outletRootSupported}).
 *
 * `{{outlet}}` compiles to the `-outlet` keyword, which reads its child from
 * Glimmer's *dynamic scope*, which `renderComponent` never populates — so route
 * templates are rendered through Ember's own outlet root instead, and this is
 * the state handed to it. Leaving `outlets.main` undefined is what makes
 * `{{outlet}}` render a hole.
 */
export function buildRouteOutletState({
  template: routeTemplate,
  route,
  outlet,
  args,
  storyName,
  owner
}: RouteStoryInput): OutletState {
  const child = outlet ? buildChildRenderState(outlet, owner) : undefined;

  return {
    render: {
      owner,
      name: route.name ?? storyName,
      template: routeTemplate,
      model: route.model ?? args.model,
      controller: route.controller ?? args.controller
    },
    outlets: mainOutlet(child)
  };
}

/**
 * Ember's `OutletView` (the router's top-level view), reduced to the surface
 * this module drives. It is only reachable through the container, so the type is
 * declared here rather than imported from `@ember/-internals`.
 */
export interface OutletView {
  appendTo(target: HTMLElement): void;
  setOutletState(state: OutletState): void;
}

interface OutletViewFactory {
  create(options: Record<string, unknown>): OutletView;
}

/**
 * The private container entries backing Ember's outlet root — the very full
 * names `Router._setOutlets()` uses. Casting through this interface keeps the
 * unsound lookups in one place instead of spread across the renderer.
 */
interface OutletContainer {
  factoryFor(fullName: string): OutletViewFactory | undefined;
  lookup(fullName: string): unknown;
}

/**
 * Whether this Ember build still hosts `{{outlet}}` in the classic outlet root.
 *
 * Until 7.5.0-alpha.2 the router always registered `view:-outlet`; the route
 * rendering work merged as emberjs/ember.js `4b5d79a` (series: `68fc807`,
 * `c0522c5`, `4b0f767`, ...) deleted the view, the `template:-outlet` and the
 * `-outlet` keyword outright. The container entry is the switch between the
 * two backends: `beta` (7.4) still ships it while `alpha` (7.5) does not, so
 * the version string cannot decide this — the probe can.
 */
export function outletRootSupported(owner: object): boolean {
  return (owner as unknown as OutletContainer).factoryFor('view:-outlet') !== undefined;
}

/**
 * The outlet-root backend for classic builds (`view:-outlet` still registered,
 * see {@link outletRootSupported}).
 *
 * `{{outlet}}` compiles to Ember's built-in `-outlet` keyword helper, which reads
 * its child from Glimmer's *dynamic scope*. `renderComponent` starts that scope
 * empty, so a route template rendered as a plain component crashes. Route stories
 * are therefore rendered through the same outlet root `Router._setOutlets()` uses
 * — reached by container name, never imported.
 */
function createOutletView(
  container: OutletContainer,
  state: OutletState,
  element: HTMLElement
): OutletView {
  const factory = container.factoryFor('view:-outlet');

  if (!factory) {
    // Unreachable via `renderToCanvas` (it probes first); guards direct callers.
    throw new Error(
      'ember-storybook: this story renders a route template, but `view:-outlet` ' +
        'is not registered on this Ember build, so the classic outlet root cannot ' +
        'be used. Ember >= 7.5.0-alpha.2 renders {{outlet}} as the `@outlet` ' +
        'argument instead; ember-storybook selects that backend automatically.'
    );
  }

  const view = factory.create({
    environment: container.lookup('-environment:main'),
    application: container.lookup('application:main'),
    // The outlet root renders `{{outlet}}` itself; the story's route template
    // arrives through the state below, as `outlets.main`.
    template: container.lookup('template:-outlet')
  });

  view.setOutletState(state);

  // `appendTo` schedules on the `render` queue, so flush the run loop to render.
  run(() => {
    view.appendTo(element);
  });

  return view;
}

/**
 * Renders `state` into `element` through Ember's outlet root and waits for the
 * render to settle.
 */
export async function mountOutletView(
  application: ApplicationInstance,
  state: OutletState,
  element: HTMLElement
): Promise<OutletView> {
  const view = createOutletView(application as unknown as OutletContainer, state, element);

  await renderSettled();

  return view;
}

/**
 * Swaps what the outlet renders, in place. This is how the router updates a live
 * route tree, so arg changes do not tear the route's components down.
 */
export async function updateOutletView(view: OutletView, state: OutletState): Promise<void> {
  view.setOutletState(state);
  await renderSettled();
}
