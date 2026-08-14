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

type RenderContextCache = {
  application: ApplicationInstance;
  renderer?: RenderResult;
  mount: HTMLElement;
  args: Args;
  globals: Record<string, unknown>;
};

const contexts = new Map<EmberRenderer['canvasElement'], RenderContextCache>();

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
    if (!Object.hasOwn(nextArgs, key)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
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

  function unmount(element: EmberRenderer['canvasElement']) {
    const context = contexts.get(element);

    if (!context) {
      return;
    }

    contexts.delete(element);
    context.renderer?.destroy();

    context.mount.remove();

    destroy(context.application);
  }

  if (forceRemount) {
    unmount(canvasElement);
  }

  // this check does not work:
  // when globals are updated, that are interesting for a decorator
  // this check would prevent that update

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
      unmount(canvasElement);
    };
  }

  // fresh mount element per render, so ember's RENDER_CACHE never has a stale
  // entry for the `into` element (this is what caused the `insertBefore` error)
  const mount = document.createElement('div');

  canvasElement.append(mount);

  // find the ember app for the story
  let application: ApplicationInstance | undefined;

  if (storyContext.parameters.ember?.app) {
    const appOption = storyContext.parameters.ember.app;

    application = initApp(appOption, { rootElement: canvasElement });
  }

  application ??= buildAppInstance(Application, { rootElement: canvasElement });

  // modify the owner for the story
  if (storyContext.parameters.ember?.owner) {
    for (const [key, obj] of Object.entries(storyContext.parameters.ember.owner) as [
      `${string}:${string}`,
      object
    ][]) {
      application.unregister(key);
      application.register(key, obj);
    }
  }

  // configure and boot the instance so ember registers necessary environments
  storyContext.parameters.ember?.configure?.(application);
  await application.boot();
  storyContext.parameters.ember?.updateGlobals?.(storyContext.globals, application);

  const trackedArgs = trackedObject({ ...args });

  contexts.set(canvasElement, {
    application,
    mount,
    args: trackedArgs,
    globals: storyContext.globals
  });

  const result = renderComponent(Component, {
    args: trackedArgs,
    into: mount,
    owner: application
  });

  (contexts.get(canvasElement) as RenderContextCache).renderer = result;

  showMain();

  return () => {
    unmount(canvasElement);
  };
}
