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

const contexts = new Map<
  EmberRenderer['canvasElement'],
  {
    application: ApplicationInstance | undefined;
    renderer: RenderResult;
    args: Args;
  }
>();

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
    context.renderer.destroy();

    if (context.application) {
      destroy(context.application);
    }
  }

  if (forceRemount) {
    unmount(canvasElement);
  }

  // this check does not work:
  // when globals are updated, that are interesting for a decorato
  // this check would prevent that update

  // const context = contexts.get(canvasElement);
  // if (context && !forceRemount && args) {
  //   updateArgs(context.args, args);
  //   return () => {
  //     unmount(canvasElement);
  //   };
  // }

  // find the ember app for the story
  let application: ApplicationInstance | undefined;

  if (storyContext.parameters.ember?.app) {
    const appOption = storyContext.parameters.ember.app;

    application = initApp(appOption, { rootElement: canvasElement });
  }

  // modify the owner for the story
  if (storyContext.parameters.ember?.owner) {
    application ??= buildAppInstance(Application, { rootElement: canvasElement });

    for (const [key, obj] of Object.entries(storyContext.parameters.ember.owner) as [
      `${string}:${string}`,
      object
    ][]) {
      application.unregister(key);
      application.register(key, obj);
    }
  }

  const trackedArgs = trackedObject({ ...args });
  const result = renderComponent(Component, {
    args: trackedArgs,
    into: canvasElement,
    owner: application
  });

  contexts.set(canvasElement, { application, renderer: result, args: trackedArgs });

  showMain();

  // eslint-disable-next-line unicorn/consistent-function-scoping
  return () => {
    // needs fix:
    // unmount(canvasElement);
  };
}

// function updateArgs(currentArgs: Args, nextArgs: Args) {
//   for (const key of Object.keys(currentArgs)) {
//     if (!(key in nextArgs)) {
//       delete currentArgs[key];
//     }
//   }

//   Object.assign(currentArgs, nextArgs);
// }
