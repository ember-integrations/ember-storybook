import type Application from '@ember/application';
import type ApplicationInstance from '@ember/application/instance';
import type Owner from '@ember/owner';
import type { StoryContext as DefaultStoryContext, WebRenderer } from 'storybook/internal/types';

export type { RenderContext } from 'storybook/internal/types';

export interface ShowErrorArgs {
  title: string;
  description: string;
}

export type AppParamater =
  | typeof Application
  | ApplicationInstance
  | ((options?: Record<string, unknown>) => typeof Application | ApplicationInstance);

/**
 * A single-level stub rendered in place of `{{outlet}}`. Ember has no named
 * outlets anymore, so a route template has exactly one child, and a story stubs
 * precisely that one child — deeper nesting is not modelled.
 */
export interface OutletStub {
  /** Route name surfaced in the placeholder label and the debug render tree. */
  name?: string;
  /** Template/component rendered as the child route. Omitted => empty hole. */
  template?: object;
  /** Value passed to the child as `@model`. */
  model?: unknown;
  /** Value passed to the child as `@controller`. */
  controller?: unknown;
}

/**
 * Opt-in marker that a story renders a *route* template rather than a component.
 *
 * Route templates receive only `@model` and `@controller` (that is all Ember's
 * outlet hands them), and their `{{outlet}}` is stubbed via {@link OutletStub}.
 */
export interface RouteParameters {
  /** Route name for the debug render tree; falls back to the story name. */
  name?: string;
  /** `@model` for the route template; falls back to `args.model`. */
  model?: unknown;
  /** `@controller` for the route template; falls back to `args.controller`. */
  controller?: unknown;
  /** What `{{outlet}}` renders. Omitted => empty hole. */
  outlet?: OutletStub;
}

export interface EmberParameters {
  // renderer: 'ember';
  ember?: {
    app?: AppParamater;
    configure?: (app: ApplicationInstance) => void;
    owner?: Record<`${string}:${string}`, object>;
    updateGlobals?: (globals: Record<string, unknown>, owner: Owner) => void;
    /** Present => render through Ember's outlet root so `{{outlet}}` works. */
    route?: RouteParameters;
  };
}

/**
 * How a route story renders `{{outlet}}`, chosen from the "Ember" toolbar menu.
 *
 * - `hole` (default): nothing renders — like a route with no active child.
 * - `placeholder`: a marker component renders in its place.
 */
export type OutletMode = 'hole' | 'placeholder';

/**
 * Globals the framework contributes. Declared on {@link EmberRenderer} so
 * `initialGlobals` and `context.globals` are typed for consumers.
 */
export interface EmberGlobals {
  outlet?: OutletMode;
}

export interface EmberRenderer extends WebRenderer {
  // We are omitting props, as we don't use it internally, and more importantly, it completely changes the assignability of meta.component.
  // Try not omitting, and check the type errros, if you want to learn more.
  component: object;
  storyResult: object; // ComponentLike
  csf4: true;
  parameters: EmberParameters;
  globals: EmberGlobals;
}

export type StoryContext = DefaultStoryContext<EmberRenderer> & {
  parameters: DefaultStoryContext<EmberRenderer>['parameters'] & EmberParameters;
  globals: DefaultStoryContext<EmberRenderer>['globals'] & EmberGlobals;
};
