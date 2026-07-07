import type { ArgsStoryFn, RenderContext } from 'storybook/internal/types';

import type { RenderResult } from '@ember/-internals/glimmer/lib/renderer';
import Application from '@ember/application';

import type { AppParamater, EmberRenderer, StoryContext } from './types';
import ApplicationInstance from '@ember/application/instance';

type Args = Record<string, unknown>;

export const render: ArgsStoryFn<EmberRenderer> = (args, context) => {
  const { id, component: Component } = context;

  if (typeof Component === 'function') {
    return { Component, args };
  } else if (typeof Component === 'object') {
    return { Component, args };
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

export async function renderToCanvas(
  { storyFn, showMain, storyContext, forceRemount }: RenderContext<EmberRenderer> & {storyContext: StoryContext},
  canvasElement: EmberRenderer['canvasElement']
) {
  const { trackedObject } = await import('@ember/reactive/collections');
  const { renderComponent } = await import('@ember/renderer');
  const { destroy } = await import('@ember/destroyable');

  const { Component, args } = storyFn();

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

  const context = contexts.get(canvasElement);
  if (context && !forceRemount) {
    updateArgs(context.args, args);
    return () => {
      unmount(canvasElement);
    };
  } else if (context) {
    unmount(canvasElement);
  }

  let application: ApplicationInstance | undefined = undefined;
  const appOptions = {
      autoboot: false,
      rootElement: canvasElement
    }

  if (storyContext.parameters.ember?.app) {
    const appOption = storyContext.parameters.ember?.app;

    function isApplication(appOption: object): appOption is Application {
      // @ts-ignore this is wild
      return appOption['create'] !== undefined && appOption.superclass && appOption.supeclass.name === 'EmberApp';
    }

    const initApp = (appOption: AppParamater) => {
      if (appOption instanceof ApplicationInstance) {
        return appOption;
      }

      if (isApplication(appOption)) {
        // @ts-ignore this is wild
        return (appOption as Application).create(appOptions).buildInstance();
      }

      return (appOption as Function)(appOptions);
    }
    
    application = initApp(appOption);
  }

  if (storyContext.parameters.ember?.owner) {
    if (!application) {
      application = Application.create(appOptions).buildInstance();
    }

    for (const [key, obj] of Object.entries(storyContext.parameters.ember?.owner) as [`${string}:${string}`, object][]) {
      application.unregister(key);
      application.register(key, obj);
    }
  }

  const trackedArgs = trackedObject({ ...args });
  const result = renderComponent(Component, {
    args: trackedArgs,
    into: canvasElement,
    owner: application,
  });

  contexts.set(canvasElement, { application, renderer: result, args: trackedArgs });

  showMain();

  return () => {
    // needs fix:
    // unmount(canvasElement);
  };
}

function updateArgs(currentArgs: Args, nextArgs: Args) {
  for (const key of Object.keys(currentArgs)) {
    if (!(key in nextArgs)) {
      delete currentArgs[key];
    }
  }
  Object.assign(currentArgs, nextArgs);
}
