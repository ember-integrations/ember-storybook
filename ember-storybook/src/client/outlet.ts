import { renderSettled } from '@ember/renderer';
import { run } from '@ember/runloop';

import type { OutletMode, OutletStub, RouteParameters } from './types';
import type ApplicationInstance from '@ember/application/instance';

/**
 * What Ember's outlet hands a route template. A route template is *not* a
 * component story: it receives exactly `@model` and `@controller`, because that
 * is all `{{outlet}}` passes down (`OUTLET_COMPONENT_TEMPLATE` in ember-source).
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
   * The resolved stub for `{{outlet}}` — see {@link resolveOutletStub}.
   * `undefined` leaves the outlet as a hole.
   */
  outlet?: OutletStub;
  /** Final (decorated) story args; `model`/`controller` feed the route. */
  args: Record<string, unknown>;
  /** Story name, used when `route.name` is not given. */
  storyName: string;
  /** The booted app instance the route renders under. */
  owner: object;
}

const DEFAULT_OUTLET_NAME = 'outlet';

/**
 * Name of the Storybook global that decides how `{{outlet}}` is rendered
 * (`hole` | `placeholder`). Declared here so the toolbar item and the renderer
 * read and write the same key.
 */
export const OUTLET_GLOBAL_KEY = 'outlet';

export interface OutletResolveInput {
  /** `parameters.ember.route` of the story being rendered. */
  route: RouteParameters;
  /** Value of the {@link OUTLET_GLOBAL_KEY} global, if any. */
  mode?: OutletMode;
  /**
   * Produces the stub rendered when the global asks for a visible placeholder.
   * Called lazily (and so may be an async chunk load) and only when needed;
   * injected so this module stays free of Ember-owned template components.
   */
  placeholder: () => OutletStub | Promise<OutletStub>;
}

/**
 * Decides what `{{outlet}}` renders.
 *
 * An explicit `route.outlet` is author intent and always wins, so a story stays
 * deterministic no matter how the toolbar is set. Otherwise the global decides:
 * `placeholder` renders the injected marker, anything else leaves a hole.
 */
export async function resolveOutletStub({
  route,
  mode,
  placeholder
}: OutletResolveInput): Promise<OutletStub | undefined> {
  if (route.outlet?.template) {
    return route.outlet;
  }

  return mode === 'placeholder' ? await placeholder() : undefined;
}

// Ember has no named outlets any more: every `{{outlet}}` is the "main" one.
function mainOutlet(child: OutletState | undefined): OutletState['outlets'] {
  return { main: child };
}

function buildChildRenderState(stub: OutletStub, owner: object): OutletState {
  return {
    render: {
      owner,
      name: stub.name ?? DEFAULT_OUTLET_NAME,
      template: stub.template as object,
      model: stub.model,
      controller: stub.controller
    },
    // One level only: a stubbed child route is a leaf, so a `{{outlet}}` inside
    // it renders a hole as well.
    outlets: mainOutlet(undefined)
  };
}

/**
 * Builds the `OutletState` for a route story.
 *
 * `{{outlet}}` reads its child from Glimmer's *dynamic scope*, which
 * `renderComponent` never populates — so route templates are rendered through
 * Ember's own outlet root instead, and this is the state handed to it. Leaving
 * `outlets.main` undefined is what makes `{{outlet}}` render a hole.
 */
export function buildRouteOutletState({
  template,
  route,
  outlet,
  args,
  storyName,
  owner
}: RouteStoryInput): OutletState {
  const child = outlet?.template ? buildChildRenderState(outlet, owner) : undefined;

  return {
    render: {
      owner,
      name: route.name ?? storyName,
      template,
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
    throw new Error(
      'ember-storybook: this story sets `parameters.ember.route`, but `view:-outlet` ' +
        'is not registered on this Ember build, so {{outlet}} cannot be rendered. ' +
        "Route stories render through Ember's own outlet root, which the router " +
        '(`Router._setOutlets()`) uses as well.'
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
