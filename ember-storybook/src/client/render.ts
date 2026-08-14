import Application from '@ember/application';
import ApplicationInstance from '@ember/application/instance';

import type { AppParamater, EmberRenderer, StoryContext } from './types';
import type { RenderResult } from '@ember/-internals/glimmer/lib/renderer';
import type { ArgsStoryFn, RenderContext } from 'storybook/internal/types';

type Args = Record<string, unknown>;

export const render: ArgsStoryFn<EmberRenderer> = (args, context) => {
  const { id, component } = context;

  if (typeof component === 'function') {
    return component;
  }

  if (typeof component === 'object') {
    return component;
  }

  throw new Error(
    `Unable to render story ${id} as the component annotation is missing from the default export`
  );
};

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => Object.hasOwn(b, key) && Object.is(a[key], b[key]))
  );
}

type CacheKey = string;

type RenderContextCache = {
  id: symbol;
  application: ApplicationInstance;
  renderer?: RenderResult;
  mount: HTMLElement;
  canvasElement: HTMLElement;
  args: Args;
  globals: Record<string, unknown>;
  storyId: string;
  key: CacheKey | undefined;
  parkTimer?: ReturnType<typeof setTimeout>;
};

// active renders, keyed by canvas element
const contexts = new Map<EmberRenderer['canvasElement'], RenderContextCache>();
// active renders, keyed by the (stable) canvas element id, so a docs-page remount
// that recreates the element can still find the booted app for the same story
const contextsById = new Map<string, RenderContextCache>();
// recently unmounted renders, kept alive briefly in case the docs page re-mounts
// the same story instance right after (globals change -> remount)
const parked = new Map<CacheKey, RenderContextCache>();

const PARK_TTL = 1000;

// booted apps, keyed by `storyId:canvasId`. Reused across docs-page remounts so
// a re-render is instant — a slow async boot leaves the StoryRender pending and
// makes Storybook fall back to `window.location.reload()`.
type CachedApp = {
  application: ApplicationInstance;
  canvasElement: HTMLElement;
};

const apps = new Map<CacheKey, CachedApp>();

function cacheKey(storyId: string, canvasElement: HTMLElement): CacheKey | undefined {
  return canvasElement.id ? `${storyId}:${canvasElement.id}` : undefined;
}

// TEMP: stable identity per canvas element for diagnostics
const elementIds = new WeakMap<HTMLElement, number>();
let elementCounter = 0;

function elementId(element: HTMLElement): string {
  let id = elementIds.get(element);

  if (id === undefined) {
    id = ++elementCounter;
    elementIds.set(element, id);
  }

  return `el#${id}`;
}

function getAppOptions(opts: { rootElement: HTMLElement }) {
  return {
    ...opts,
    autoboot: false
  };
}

function buildAppInstance(application: typeof Application, opts: { rootElement: HTMLElement }) {
  return application.create(getAppOptions(opts)).buildInstance();
}

function isApplication(maybeApp: object): maybeApp is typeof Application {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return (
    // @ts-expect-error well, ember types
    maybeApp.create !== undefined &&
    // @ts-expect-error well, ember types
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    maybeApp.superclass &&
    // @ts-expect-error well, ember types
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    maybeApp.superclass.name === 'EmberApp'
  );
}

function initApp(appOption: AppParamater, opts: { rootElement: HTMLElement }): ApplicationInstance {
  if (appOption instanceof ApplicationInstance) {
    return appOption;
  }

  if (isApplication(appOption)) {
    return buildAppInstance(appOption, opts);
  }

  // eslint-disable-next-line unicorn/no-useless-recursion
  return initApp(appOption(getAppOptions(opts)), opts);
}

function updateArgs(currentArgs: Args, nextArgs: Args) {
  for (const key of Object.keys(currentArgs)) {
    if (!(key in nextArgs)) {
      delete currentArgs[key];
    }
  }

  Object.assign(currentArgs, nextArgs);
}

export async function renderToCanvas(
  {
    storyFn,
    showMain,
    storyContext,
    forceRemount
  }: RenderContext<EmberRenderer> & { storyContext: StoryContext },
  canvasElement: EmberRenderer['canvasElement']
) {
  const { trackedObject } = await import('@ember/reactive/collections');
  const { renderComponent } = await import('@ember/renderer');
  const { destroy } = await import('@ember/destroyable');

  const args = storyContext.args;
  const Component = storyFn();
  const storyId = storyContext.id;
  const key = cacheKey(storyId, canvasElement);
  const el = elementId(canvasElement);

  // TEMP: instrumentation
  console.log(
    `[renderToCanvas] story=${storyId} forceRemount=${forceRemount} canvas="${canvasElement.id || 'no-id'}" ${el} key=${String(key)} contexts=${contexts.size} hasEl=${contexts.has(canvasElement)} byId=${canvasElement.id ? contextsById.has(canvasElement.id) : '-'} parked=${parked.size}`
  );

  function applyGlobals(context: RenderContextCache) {
    if (shallowEqual(context.globals, storyContext.globals)) {
      return;
    }

    storyContext.parameters.ember?.updateGlobals?.(storyContext.globals, context.application);
    context.globals = { ...storyContext.globals };
  }

  function destroyContext(context: RenderContextCache) {
    if (context.parkTimer !== undefined) {
      clearTimeout(context.parkTimer);
    }

    contexts.delete(context.canvasElement);

    if (context.canvasElement.id) {
      contextsById.delete(context.canvasElement.id);
    }

    if (context.key) {
      parked.delete(context.key);
    }

    console.log(`[unmount] destroy story=${context.storyId} ${elementId(context.canvasElement)}`);

    context.renderer?.destroy();
    context.mount.remove();

    // the app stays alive in `apps` so a docs-page remount can reuse it
    // without re-booting
  }

  function parkContext(context: RenderContextCache) {
    const contextKey = context.key;

    if (!contextKey) {
      destroyContext(context);

      return;
    }

    contexts.delete(context.canvasElement);

    if (context.canvasElement.id) {
      contextsById.delete(context.canvasElement.id);
    }

    parked.set(contextKey, context);

    console.log(`[unmount] park story=${context.storyId} ${elementId(context.canvasElement)}`);

    context.parkTimer = setTimeout(() => {
      parked.delete(contextKey);
      console.log(
        `[unmount] ttl-destroy story=${context.storyId} ${elementId(context.canvasElement)}`
      );
      context.renderer?.destroy();
      context.mount.remove();
    }, PARK_TTL);
  }

  function unmount(element: EmberRenderer['canvasElement']) {
    const context = contexts.get(element);

    if (context?.canvasElement !== element) {
      console.log(
        `[unmount] story=${context?.storyId ?? '?'} ${elementId(element)} skip (no matching context)`
      );

      return;
    }

    if (context.key) {
      parkContext(context);
    } else {
      destroyContext(context);
    }
  }

  function unmountIfOwned(element: EmberRenderer['canvasElement'], id: symbol) {
    const context = contexts.get(element);

    if (context?.id === id) {
      unmount(element);
    } else {
      // a stale (deferred) teardown from a previous render — must not touch the
      // current context
      console.log(`[unmount] story=${storyId} ${elementId(element)} owned=NO`);
    }
  }

  if (forceRemount) {
    const sameElement = contexts.get(canvasElement);

    // docs remount — find the booted app for this story. The canvas element may
    // be the same or recreated; search active contexts (by element and by stable
    // canvas id) and parked contexts (by storyId + canvas id).
    let existing =
      sameElement?.storyId === storyId
        ? sameElement
        : canvasElement.id
          ? contextsById.get(canvasElement.id)
          : undefined;

    if (existing?.storyId !== storyId) {
      existing = undefined;
    }

    if (!existing && canvasElement.id) {
      for (const context of contexts.values()) {
        if (context.storyId === storyId && context.canvasElement.id === canvasElement.id) {
          existing = context;

          break;
        }
      }
    }

    if (!existing && key) {
      const parkedContext = parked.get(key);

      if (parkedContext?.storyId === storyId) {
        existing = parkedContext;
      }
    }

    if (existing) {
      const sameArgs = shallowEqual(existing.args, args);
      const wasParked = existing.key !== undefined && parked.has(existing.key);

      console.log(
        `[renderToCanvas] REUSE story=${storyId} canvas="${canvasElement.id || 'no-id'}" ${el} existingEl=${elementId(existing.canvasElement)} sameArgs=${sameArgs} fromParked=${wasParked}`
      );

      if (wasParked) {
        if (existing.parkTimer !== undefined) {
          clearTimeout(existing.parkTimer);
        }

        parked.delete(existing.key as CacheKey);
      }

      applyGlobals(existing);

      if (!sameArgs) {
        updateArgs(existing.args, args);

        const result = renderComponent(Component, {
          args: existing.args,
          into: existing.mount,
          owner: existing.application
        });

        existing.renderer = result;
      }

      if (existing.canvasElement !== canvasElement) {
        contexts.delete(existing.canvasElement);
        existing.mount.remove();
        canvasElement.append(existing.mount);
        existing.canvasElement = canvasElement;
      }

      contexts.set(canvasElement, existing);

      if (canvasElement.id) {
        contextsById.set(canvasElement.id, existing);
      }

      // bump the generation so any stale (deferred) teardown from the previous
      // render no longer owns this context and can't destroy the reused app
      existing.id = Symbol('render');

      const id = existing.id;

      return () => {
        unmountIfOwned(canvasElement, id);
      };
    }

    // anything else occupying this canvas (different story / different args)
    if (sameElement && sameElement.storyId !== storyId) {
      destroyContext(sameElement);
    }
  }

  const context = contexts.get(canvasElement);

  if (context && !forceRemount) {
    const argsChanged = !shallowEqual(context.args, args);
    const globalsChanged = !shallowEqual(context.globals, storyContext.globals);

    if (globalsChanged) {
      storyContext.parameters.ember?.updateGlobals?.(storyContext.globals, context.application);
      context.globals = { ...storyContext.globals };
    }

    if (argsChanged || !globalsChanged) {
      updateArgs(context.args, args);

      const result = renderComponent(Component, {
        args: context.args,
        into: context.mount,
        owner: context.application
      });

      context.renderer = result;
    }

    return () => {
      unmountIfOwned(canvasElement, context.id);
    };
  }

  // a different story instance is parked on this canvas (story-view navigation)
  // — release its rootElement before booting a new app
  for (const entry of parked.values()) {
    if (entry.canvasElement === canvasElement) {
      destroyContext(entry);
    }
  }

  // fresh mount element per render, so ember's RENDER_CACHE never has a stale
  // entry for the `into` element (this is what caused the `insertBefore` error)
  const mount = document.createElement('div');

  canvasElement.append(mount);

  console.log(
    `[renderToCanvas] BOOT story=${storyId} canvas="${canvasElement.id || 'no-id'}" ${el}`
  );

  // find the ember app for the story — reuse a previously booted app for this
  // story instance so a docs-page remount never has to boot (which would leave
  // the StoryRender pending and make Storybook reload the page)
  let application: ApplicationInstance | undefined;

  if (key) {
    application = apps.get(key)?.application;
  }

  if (application) {
    console.log(`[renderToCanvas] REUSE-APP story=${storyId} ${el}`);
  } else {
    // a different story taking over this canvas (story-view navigation) releases
    // the cached app so its rootElement can be re-used
    for (const [cachedKey, entry] of apps) {
      if (entry.canvasElement === canvasElement) {
        apps.delete(cachedKey);
        destroy(entry.application);
      }
    }

    if (storyContext.parameters.ember?.app) {
      const appOption = storyContext.parameters.ember.app;

      application = initApp(appOption, { rootElement: canvasElement });
    }

    application ??= buildAppInstance(Application, { rootElement: canvasElement });

    // modify the owner for the story
    if (storyContext.parameters.ember?.owner) {
      for (const [name, obj] of Object.entries(storyContext.parameters.ember.owner) as [
        `${string}:${string}`,
        object
      ][]) {
        application.unregister(name);
        application.register(name, obj);
      }
    }

    // configure and boot the instance so ember registers necessary environments
    storyContext.parameters.ember?.configure?.(application);
    await application.boot();

    if (key) {
      apps.set(key, { application, canvasElement });
    }
  }

  storyContext.parameters.ember?.updateGlobals?.(storyContext.globals, application);

  const trackedArgs = trackedObject({ ...args });

  const id = Symbol('render');

  const cache: RenderContextCache = {
    id,
    application,
    mount,
    canvasElement,
    args: trackedArgs,
    globals: storyContext.globals,
    storyId,
    key
  };

  contexts.set(canvasElement, cache);

  if (canvasElement.id) {
    contextsById.set(canvasElement.id, cache);
  }

  console.log(
    `[renderToCanvas] registered story=${storyId} ${el} contexts=${contexts.size} byId=${contextsById.size}`
  );

  const result = renderComponent(Component, {
    args: trackedArgs,
    into: mount,
    owner: application
  });

  cache.renderer = result;

  showMain();

  return () => {
    unmountIfOwned(canvasElement, id);
  };
}
