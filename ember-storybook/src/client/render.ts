import Application from '@ember/application';
import ApplicationInstance from '@ember/application/instance';
import { destroy } from '@ember/destroyable';
import { renderComponent } from '@ember/renderer';
import { VERSION } from '@ember/version';

import { createAppResolver, type EmberStoryResult, normalizeStoryResult } from './story-result';

import type { AppParamater, EmberRenderer, StoryContext } from './types';
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

  if (typeof component === 'function') {
    return { component, args };
  }

  if (typeof component === 'object') {
    return { component, args };
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

type RenderContextCache = {
  application: ApplicationInstance;
  renderer?: RenderResult;
  mount: HTMLElement;
  args: Args;
  globals: Record<string, unknown>;
};

const contexts = new Map<EmberRenderer['canvasElement'], RenderContextCache>();

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
    context.renderer?.destroy();
    context.mount.remove();
    destroy(context.application);
  }

  // The story function carries the decorator pipeline; the framework's `render`
  // reports the final (possibly decorator-transformed) args back in its result.
  const storyResult = storyFn();
  const { component, args } = normalizeStoryResult(storyResult, storyContext.args);

  const existing = contexts.get(canvasElement);
  const globalsChanged =
    existing !== undefined &&
    !forceRemount &&
    !shallowEqual(existing.globals, storyContext.globals);

  // Nothing to do: a globals-only change (or a no-op call) must not tear down the
  // mounted component.
  if (existing && !forceRemount && !globalsChanged && shallowEqual(existing.args, args)) {
    return () => {
      unregister(canvasElement);
    };
  }

  // Reuse the booted app across arg/globals updates, but always render into a
  // fresh mount: reusing the same mount makes Ember's render cache serve a stale
  // entry, which destroyed renders with obscure node errors (#27, #33).
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
  } else if (existing && !forceRemount) {
    // ember-source >= 6.12 caches one renderer per owner, so we can keep the same
    // app instance across re-renders. This preserves component/app state (@tracked
    // fields, services) and avoids re-booting on every control/global change.
    if (globalsChanged) {
      storyContext.parameters.ember?.updateGlobals?.(storyContext.globals, existing.application);
    }

    application = existing.application;
    existing.renderer?.destroy();
    existing.mount.remove();
  } else {
    if (existing) {
      unregister(canvasElement);
    }

    application = await bootApp(storyContext, canvasElement);
  }

  const mount = document.createElement('div');

  canvasElement.append(mount);

  const renderer = renderComponent(component, {
    args,
    into: mount,
    owner: application
  });

  contexts.set(canvasElement, {
    application,
    mount,
    renderer,
    args,
    globals: { ...storyContext.globals }
  });

  showMain();

  return () => {
    unregister(canvasElement);
  };
}
