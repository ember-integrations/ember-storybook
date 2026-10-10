import type Application from '@ember/application';
import type ApplicationInstance from '@ember/application/instance';
import type Owner from '@ember/owner';
// The invokable type for `parameters.ember.route.outlet` is Glint's official
// `ComponentLike` — the type `<template>` expressions get in a Glint app, and
// what Ember's `@outlet` argument holds. Not re-exported by this package:
// consumers use the official type. (Re-point this import at `@ember/template`
// once ember-source exposes `ComponentLike` from there — that module currently
// ships only the SafeString helpers.)
import type { ComponentLike } from '@glint/template';
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
 * Route options for a story that renders a *route* template rather than a
 * component.
 *
 * A story is rendered as a route story when this parameter is present, or when
 * the story's template references `{{outlet}}` (#62) — the latter implicitly,
 * with empty route parameters.
 *
 * Route templates receive only `@model`, `@controller` and `@outlet` — exactly
 * what Ember's own route rendering hands them. Their `{{outlet}}` renders
 * whatever `outlet` says, mirroring the `@outlet` argument:
 *
 * - `string` — the framework placeholder, labeled with the string.
 * - `ComponentLike` — that component renders in the outlet position (one leaf
 *   level: a `{{outlet}}` inside it renders a hole). Ember has no named outlets
 *   anymore, so there is exactly one outlet to stub.
 * - omitted — the "Ember" toolbar menu decides: `hole` (nothing) or
 *   `placeholder` (the unlabeled marker).
 */
export interface RouteParameters {
  /** Route name for the debug render tree; falls back to the story name. */
  name?: string;
  /** `@model` for the route template; falls back to `args.model`. */
  model?: unknown;
  /** `@controller` for the route template; falls back to `args.controller`. */
  controller?: unknown;
  /** What `{{outlet}}` renders; see {@link RouteParameters}. */
  outlet?: string | ComponentLike;
}

export interface EmberParameters {
  // renderer: 'ember';
  ember?: {
    app?: AppParamater;
    configure?: (app: ApplicationInstance) => void;
    owner?: Record<`${string}:${string}`, object>;
    updateGlobals?: (globals: Record<string, unknown>, owner: Owner) => void;
    /**
     * Present => render so that `{{outlet}}` works: through Ember's outlet root
     * on builds that have it, as a component receiving `@outlet` on RFC 1099
     * route rendering (ember-source >= 7.5.0-alpha.2).
     * A template that uses `{{outlet}}` is rendered that way even without
     * this parameter — then with empty route parameters (#62).
     */
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
