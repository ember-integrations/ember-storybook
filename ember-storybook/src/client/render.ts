import type { ArgsStoryFn, RenderContext } from 'storybook/internal/types';

import type { RenderResult } from '@ember/-internals/glimmer/lib/renderer';
import Application from '@ember/application';

import type { AppParamater, EmberRenderer, StoryContext } from './types';
import ApplicationInstance from '@ember/application/instance';

type Args = Record<string, unknown>;

export const render: ArgsStoryFn<EmberRenderer> = (args, context) => {
  const { id, component } = context;

  if (typeof component === 'function') {
    return component;
  } else if (typeof component === 'object') {
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

function getAppOptions(opts: { rootElement: HTMLElement}) {
  return {
    ...opts,
    autoboot: false
  };
}

function buildAppInstance(application: typeof Application, opts: { rootElement: HTMLElement}) {
  return application.create(getAppOptions(opts)).buildInstance();
}

export async function renderToCanvas(
  { storyFn, showMain, storyContext, forceRemount }: RenderContext<EmberRenderer> & {storyContext: StoryContext},
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

  // find the ember application for the story
  let application: ApplicationInstance | undefined = undefined;
  

  if (storyContext.parameters.ember?.app) {
    const appOption = storyContext.parameters.ember?.app;

    function isApplication(appOption: object): appOption is typeof Application {
      // @ts-ignore this is wild
      return appOption['create'] !== undefined && appOption.superclass && appOption.supeclass.name === 'EmberApp';
    }

    const initApp = (appOption: AppParamater) => {
      if (appOption instanceof ApplicationInstance) {
        return appOption;
      }

      if (isApplication(appOption)) {
        return buildAppInstance(appOption, {rootElement: canvasElement});
      }

      return (appOption as Function)(getAppOptions({rootElement: canvasElement}));
    }
    
    application = initApp(appOption);
  }

  // modify the owner for the story
  if (storyContext.parameters.ember?.owner) {
    if (!application) {
      application = buildAppInstance(Application, {rootElement: canvasElement});
    }

    for (const [key, obj] of Object.entries(storyContext.parameters.ember?.owner) as [`${string}:${string}`, object][]) {
      application.unregister(key);
      application.register(key, obj);
    }
  }

  const trackedArgs = trackedObject({ ...(args ?? {}) });
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
