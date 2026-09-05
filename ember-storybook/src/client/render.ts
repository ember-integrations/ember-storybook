import Application from '@ember/application';
import ApplicationInstance from '@ember/application/instance';
import { destroy } from '@ember/destroyable';
import { renderComponent } from '@ember/renderer';
import { VERSION } from '@ember/version';

import { OUTLET_GLOBAL_KEY } from '../outlet-key';
import {
  buildRouteOutletState,
  mountOutletView,
  resolveOutletStub,
  updateOutletView
} from './outlet';
import { createAppResolver, type EmberStoryResult, normalizeStoryResult } from './story-result';

import type { OutletView } from './outlet';
import type {
  AppParamater,
  EmberGlobals,
  EmberRenderer,
  OutletStub,
  RouteParameters,
  StoryContext
} from './types';
import type { RenderResult } from '@ember/-internals/glimmer/lib/renderer';
import type { ArgsStoryFn, RenderContext } from 'storybook/internal/types';

type Args = Record<string, unknown>;

// ember-source < 6.12 built a brand-new `BaseRenderer` (EvaluationContext) on
// every `renderComponent` call and had no per-owner renderer cache. Re-rendering
// an already-rendered owner therefore produced multiple live EvaluationContexts
// that corrupted glimmer's shared opcode table, crashing with
// "Cannot read properties of null (reading 'syscall')". 6.12+ added that cache
// (`RENDERER_CACHE` keyed by owner), so reusing an app across renders is only
// safe from 6.12 onward.
function isEmberBelow(major: number, minor: number): boolean {
  const [maj, min] = VERSION.split('.').map(Number);

  return maj < major || (maj === major && min < minor);
}

export const render: ArgsStoryFn<EmberRenderer> = (args, context): EmberStoryResult => {
  const { id, component } = context;
  // `ArgsStoryFn`'s context types `parameters` loosely; the framework's own
  // `StoryContext` carries the typed `ember` bag.
  const { ember } = context.parameters as StoryContext['parameters'];
  const route = ember?.route;

  if (typeof component === 'function' || typeof component === 'object') {
    // `route` is reported back like `args` are: `<RenderStory>` gets nothing but
    // the story result, and it needs to know a story is a route story.
    return { component, args, route };
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

const withoutOutletGlobal = (globals: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(globals).filter(([key]) => key !== OUTLET_GLOBAL_KEY));

/**
 * Globals the renderer actually reacts to.
 *
 * The outlet menu only concerns route stories, so for a plain component story its
 * value is stripped: toggling "Ember" would otherwise count as a globals change
 * and needlessly remount (throwing away the component's state).
 */
function relevantGlobals(
  route: RouteParameters | undefined,
  globals: Record<string, unknown>
): Record<string, unknown> {
  return route ? globals : withoutOutletGlobal(globals);
}

type RenderContextCache = {
  application: ApplicationInstance;
  mount: HTMLElement;
  args: Args;
  globals: Record<string, unknown>;
  // A story is mounted either as a plain component (`renderer`) or, for route
  // templates, through Ember's outlet root (`outletView`) — never both.
  renderer?: RenderResult;
  outletView?: OutletView;
};

const contexts = new Map<EmberRenderer['canvasElement'], RenderContextCache>();

/**
 * Tears the mounted story down, leaving the booted app alone so it can be
 * reused.
 *
 * Route stories are deliberately not cleaned up here: the outlet root is dropped
 * by destroying the app (which clears *and deregisters* its roots), and
 * `Renderer.cleanupRootFor()` would empty the root list without deregistering —
 * leaving the renderer in the global set so the next append would assert "Cannot
 * register the same renderer twice".
 */
function teardownMount(context: RenderContextCache) {
  context.renderer?.destroy();
  context.mount.remove();
}

/**
 * The stub rendered when the toolbar asks for a visible placeholder.
 *
 * Loaded on demand rather than imported: folding the compiled template into the
 * boot chunk makes the bundler emit a `node:module` `createRequire` shim into it,
 * which throws in the browser and takes `renderToCanvas` — and with it every
 * story — down with it.
 */
async function loadPlaceholderStub(): Promise<OutletStub> {
  // Typed explicitly: the `.gts` module has no declaration reachable from here.
  const { OutletPlaceholder } = (await import('./outlet-placeholder.gts')) as {
    OutletPlaceholder: object;
  };

  // A route template receives only @model/@controller, so the marker renders its
  // own "outlet" label when the author did not supply one.
  return { name: 'outlet', template: OutletPlaceholder };
}

async function routeOutletState({
  component,
  args,
  route,
  globals,
  storyName,
  application
}: {
  component: object;
  args: Args;
  route: RouteParameters;
  globals: EmberGlobals;
  storyName: string;
  application: ApplicationInstance;
}) {
  return buildRouteOutletState({
    template: component,
    route,
    outlet: await resolveOutletStub({
      route,
      mode: globals[OUTLET_GLOBAL_KEY],
      placeholder: loadPlaceholderStub
    }),
    args,
    storyName,
    owner: application
  });
}

async function mountStory({
  application,
  component,
  args,
  route,
  globals,
  storyName,
  mount
}: {
  application: ApplicationInstance;
  component: object;
  args: Args;
  route?: RouteParameters;
  globals: EmberGlobals;
  storyName: string;
  mount: HTMLElement;
}): Promise<Pick<RenderContextCache, 'renderer' | 'outletView'>> {
  if (!route) {
    return {
      renderer: renderComponent(component, { args, into: mount, owner: application })
    };
  }

  // `{{outlet}}` reads its child from Glimmer's dynamic scope, which
  // `renderComponent` never populates — so a route template rendered as a plain
  // component throws instead of rendering. Route stories go through Ember's own
  // outlet root; the toolbar global decides whether `{{outlet}}` is a hole or a
  // placeholder (an explicit `route.outlet` overrides it).
  const outletView = await mountOutletView(
    application,
    await routeOutletState({ component, args, route, globals, storyName, application }),
    mount
  );

  return { outletView };
}

const resolveAppOption = createAppResolver({
  application: Application,
  applicationInstance: ApplicationInstance
});

function initApp(appOption: AppParamater, opts: { rootElement: HTMLElement }) {
  return resolveAppOption(appOption, opts) as ApplicationInstance;
}

async function bootApp(
  storyContext: StoryContext,
  canvasElement: EmberRenderer['canvasElement']
): Promise<ApplicationInstance> {
  const ember = storyContext.parameters.ember;

  if (!ember?.app) {
    const options = Object.keys(storyContext.parameters)
      .filter((key) => key.toLowerCase().includes('ember'))
      .join(', ');

    throw new Error(
      [
        'ember-storybook: no Ember application configured for this story.',
        'Set `parameters.ember.app` in your preview (e.g. `.storybook/preview.ts`) to a function',
        'returning an Application or ApplicationInstance. When not provided, every render would',
        `boot a bare Application without any resolver, failing with an obscure error. Found \`parameters\` keys: ${options || '(none)'}.`
      ].join(' ')
    );
  }

  const application: ApplicationInstance = initApp(ember.app, { rootElement: canvasElement });

  // modify the owner for the story
  if (ember.owner) {
    for (const [key, obj] of Object.entries(ember.owner) as [`${string}:${string}`, object][]) {
      application.unregister(key);
      application.register(key, obj);
    }
  }

  // configure and boot the instance so ember registers necessary environments
  ember.configure?.(application);
  await application.boot();
  ember.updateGlobals?.(storyContext.globals, application);

  return application;
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
  function unregister(element: EmberRenderer['canvasElement']) {
    const context = contexts.get(element);

    if (!context) {
      return;
    }

    contexts.delete(element);
    teardownMount(context);
    destroy(context.application);
  }

  // The story function carries the decorator pipeline; the framework's `render`
  // reports the final (possibly decorator-transformed) args back in its result.
  const storyResult = storyFn();
  const {
    component,
    args,
    route: routeFromStory
  } = normalizeStoryResult(storyResult, storyContext.args);
  // Stories that define their own `render` never report a route back, so the
  // parameter is the fallback.
  const route = routeFromStory ?? storyContext.parameters.ember?.route;

  const existing = contexts.get(canvasElement);
  const previousGlobals = relevantGlobals(route, existing?.globals ?? {});
  const currentGlobals = relevantGlobals(route, storyContext.globals);
  const globalsChanged =
    existing !== undefined && !forceRemount && !shallowEqual(previousGlobals, currentGlobals);

  // Nothing to do: a globals-only change (or a no-op call) must not tear down the
  // mounted component.
  if (existing && !forceRemount && !globalsChanged && shallowEqual(existing.args, args)) {
    return () => {
      unregister(canvasElement);
    };
  }

  // An outlet root is not tracked by the mount cache that broke component re-renders
  // (#27, #33), so it can be updated in place exactly the way the router swaps route
  // state. That preserves the route tree's component state and avoids re-appending.
  if (route && existing?.outletView && !forceRemount) {
    if (globalsChanged) {
      storyContext.parameters.ember?.updateGlobals?.(storyContext.globals, existing.application);
    }

    await updateOutletView(
      existing.outletView,
      await routeOutletState({
        component,
        args,
        route,
        globals: storyContext.globals,
        storyName: storyContext.name,
        application: existing.application
      })
    );

    contexts.set(canvasElement, { ...existing, args, globals: { ...storyContext.globals } });

    showMain();

    return () => {
      unregister(canvasElement);
    };
  }

  // Reuse the booted app across arg/globals updates, but always render into a
  // fresh mount: reusing the same mount makes Ember's render cache serve a stale
  // entry, which destroyed renders with obscure node errors (#27, #33).
  //
  // A route story and a component story cannot share an app: the outlet root can
  // only be dropped by destroying the app, so switching modes remounts.
  const canReuseApp =
    existing !== undefined && !forceRemount && Boolean(existing.outletView) === Boolean(route);

  let application: ApplicationInstance;

  if (isEmberBelow(6, 12)) {
    // Exception: ember-source < 6.12 has no per-owner renderer cache, so every
    // `renderComponent` call builds a new renderer (EvaluationContext) and
    // re-rendering an already-rendered owner corrupts the shared opcode table,
    // crashing with "reading 'syscall'". Boot a fresh app on every render instead,
    // so each owner is only ever rendered once (at the cost of app state + perf).
    if (existing) {
      unregister(canvasElement);
    }

    application = await bootApp(storyContext, canvasElement);
  } else if (canReuseApp) {
    // ember-source >= 6.12 caches one renderer per owner, so we can keep the same
    // app instance across re-renders. This preserves component/app state (@tracked
    // fields, services) and avoids re-booting on every control/global change.
    if (globalsChanged) {
      storyContext.parameters.ember?.updateGlobals?.(storyContext.globals, existing.application);
    }

    application = existing.application;
    teardownMount(existing);
  } else {
    if (existing) {
      unregister(canvasElement);
    }

    application = await bootApp(storyContext, canvasElement);
  }

  const mount = document.createElement('div');

  canvasElement.append(mount);

  const mounted = await mountStory({
    application,
    component,
    args,
    route,
    globals: storyContext.globals,
    storyName: storyContext.name,
    mount
  });

  contexts.set(canvasElement, {
    application,
    mount,
    args,
    globals: { ...storyContext.globals },
    ...mounted
  });

  showMain();

  return () => {
    unregister(canvasElement);
  };
}
