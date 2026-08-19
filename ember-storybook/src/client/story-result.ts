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
 */
export interface EmberStoryResult {
  component: object;
  args: Args;
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
} {
  if (isEmberStoryResult(result)) {
    return { component: result.component, args: result.args };
  }

  return { component: result as object, args: fallbackArgs };
}

/**
 * Builds a resolver that turns an `ember.app` parameter into an app
 * instance. The Ember classes are injected so the logic can be unit tested
 * without a running Ember app.
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

    return typeof candidate.create === 'function' && candidate.prototype instanceof applicationCtor;
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
