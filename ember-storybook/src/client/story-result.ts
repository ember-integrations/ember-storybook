import type { RouteParameters } from './types';

type Args = Record<string, unknown>;

/**
 * Structural shapes of `@ember/application` and `@ember/application/instance`.
 * Used so the resolver can be unit tested without importing Ember at runtime.
 */
export interface ApplicationClass {
  prototype: object;
  create(options?: Record<string, unknown>): { buildInstance(): object };
}

export type ApplicationInstanceClass = new (...args: never[]) => object;

/**
 * The result of the framework's default `render` function.
 *
 * Storybook's decorator pipeline delivers the (possibly decorator-transformed)
 * args to `render` via `originalStoryFn(args, context)` — but nothing else. To
 * make those args reach `renderToCanvas`, `render` reports them back alongside
 * the component instead of returning a bare component.
 *
 * `route` rides along the same way: it is the only channel by which a story
 * rendered through `<RenderStory>` (which never sees the story context) can learn
 * it is a route story.
 */
export interface EmberStoryResult {
  component: object;
  args: Args;
  route?: RouteParameters;
}

export function isEmberStoryResult(value: unknown): value is EmberStoryResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'component' in value &&
    'args' in value &&
    value.args !== null &&
    typeof value.args === 'object'
  );
}

/**
 * Normalizes whatever `storyFn()` returned into `{ component, args }`.
 *
 * - A story rendered through the framework's `render` returns an `EmberStoryResult`
 *   whose `args` are the final (decorated) args.
 * - A story with its own `render` (e.g. a template) returns the component/template
 *   directly; in that case the args are the raw `fallbackArgs` (the story already
 *   captured what it needs).
 */
export function normalizeStoryResult(
  result: unknown,
  fallbackArgs: Args
): {
  component: object;
  args: Args;
  route?: RouteParameters;
} {
  if (isEmberStoryResult(result)) {
    return { component: result.component, args: result.args, route: result.route };
  }

  return { component: result as object, args: fallbackArgs };
}

/**
 * Builds a resolver that turns an `ember.app` parameter into an app
 * instance. The Ember classes are injected so the logic can be unit tested
 * without a running Ember app.
 *
 * Resolves the `AppParamater` union the way `bootApp` needs it:
 * - An ApplicationInstance is returned unchanged.
 * - An Application class (base or subclass) is built via `create(...).buildInstance()`.
 * - Anything else is treated as a factory returning either, and recursed into.
 */
function getAppOptions(opts: { rootElement: HTMLElement }) {
  return {
    ...opts,
    autoboot: false
  };
}

export function createAppResolver(params: {
  application: ApplicationClass;
  applicationInstance: ApplicationInstanceClass;
}): (appOption: unknown, opts: { rootElement: HTMLElement }) => object {
  const { application, applicationInstance } = params;

  const applicationCtor = application as unknown as new (...args: never[]) => object;
  const applicationInstanceCtor = applicationInstance;

  function isApplicationClass(maybeApp: unknown): boolean {
    if (typeof maybeApp !== 'function') {
      return false;
    }

    const candidate = maybeApp as unknown as { create?: unknown; prototype?: object };

    return (
      typeof candidate.create === 'function' &&
      // The base `Application` class itself fails the `prototype instanceof`
      // check (Ember's factory bootstrap means its own prototype isn't an
      // instance of itself), so accept it by identity as well.
      (maybeApp === applicationCtor || candidate.prototype instanceof applicationCtor)
    );
  }

  function buildAppInstance(app: ApplicationClass, opts: { rootElement: HTMLElement }) {
    return app.create(getAppOptions(opts)).buildInstance();
  }

  function initApp(appOption: unknown, opts: { rootElement: HTMLElement }): object {
    if (appOption instanceof applicationInstanceCtor) {
      return appOption;
    }

    if (isApplicationClass(appOption)) {
      return buildAppInstance(appOption as ApplicationClass, opts);
    }

    // eslint-disable-next-line unicorn/no-useless-recursion
    return initApp(
      (appOption as (options?: Record<string, unknown>) => unknown)(getAppOptions(opts)),
      opts
    );
  }

  return initApp;
}
