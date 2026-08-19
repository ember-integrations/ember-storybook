import { App, createApp } from '#app/app.ts';

import { expect } from 'storybook/test';

import { Greeting } from './greeting.gts';

import type { Meta, StoryObj } from 'ember-storybook';

// Verifies the `AppParamater` shapes that can actually render are accepted as
// `parameters.ember.app`:
//
//   type AppParamater =
//     | typeof Application                       // Application class (base or subclass)
//     | ApplicationInstance                      // a booted instance
//     | (options?) => typeof Application | ApplicationInstance  // factory
//
// Each story overrides the project-level `parameters.ember.app` from
// `.storybook/preview.ts` (a factory returning an instance) with one of these
// shapes. The framework boots the app and renders the component into the canvas;
// the `play` fn asserts that happened — proving the app option resolved instead
// of crashing with an NPE.
//
// NOTE: this file covers the `AppParamater` union members that can render a
// component. The "class" member is exercised via the demo's resolver-backed
// subclass `App` — a bare `@ember/application` `Application` (not subclassed)
// carries no `Resolver` and cannot render, and is instead covered at the
// recognition level by the addon unit tests (`src/client/story-result.test.ts`).

export default {
  title: 'Regression/AppParameter',
  component: Greeting,
  args: {
    name: 'there'
  }
} satisfies Meta;

// The demo's Application subclass (`ember-strict-application-resolver`),
// provided directly as the app class.
export const ApplicationClass: StoryObj = {
  parameters: {
    ember: {
      app: App
    }
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.textContent).toContain('Hello');
  }
};

// A booted ApplicationInstance, as produced by the app's own `createApp()`.
export const ApplicationInstance: StoryObj = {
  parameters: {
    ember: {
      app: createApp()
    }
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.textContent).toContain('Hello');
  }
};

// A factory returning an Application class.
export const FactoryReturningClass: StoryObj = {
  parameters: {
    ember: {
      app: () => App
    }
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.textContent).toContain('Hello');
  }
};

// A factory returning an ApplicationInstance (the project-level default).
export const FactoryReturningInstance: StoryObj = {
  parameters: {
    ember: {
      app: (options: Record<string, unknown>) => createApp(options)
    }
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.textContent).toContain('Hello');
  }
};
