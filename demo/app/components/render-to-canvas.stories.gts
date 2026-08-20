import { renderToCanvas } from 'ember-storybook';
import { expect } from 'storybook/test';

import { Greeting } from './greeting.gts';

import type { Meta, StoryObj } from 'ember-storybook';

// Regression tests for the `renderToCanvas` rewrite (milestone "Fix renderToCanvas": #27, #30, #31, #33).
//
// These stories drive `renderToCanvas` directly, mimicking what Storybook's
// `StoryRender` does when a story first renders (`forceRemount: true`) and then
// re-renders because args/globals changed (`forceRemount: false`).
//
// NOTE: the addon-vitest transform replaces function values in story exports
// with `null` (JSON round-trip), so any decorator used in these tests must be
// injected at runtime via `composeStory` instead of being declared on the story.
//
// This harness pokes at Storybook/ember-storybook internals (`unboundStoryFn`,
// raw `renderToCanvas`) whose types are `any`, so strict unsafe-type rules and
// the floating-promise rule are disabled for this file only.
/* eslint-disable @typescript-eslint/no-unsafe-assignment,
  @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return,
  @typescript-eslint/no-floating-promises */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

function createCanvas(): HTMLElement {
  const canvas = document.createElement('div');

  document.body.prepend(canvas);

  return canvas;
}

function renderTo(canvas: HTMLElement, storyFn: Loose, storyContext: Loose, forceRemount: boolean) {
  return renderToCanvas(
    {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      showMain: () => {},
      showError: (error: { title: string; description: string }) => {
        throw new Error(`${error.title}\n${error.description}`);
      },
      showException: (error: unknown) => {
        throw error;
      },
      forceRemount,
      storyContext,
      storyFn
    } as never,
    canvas
  );
}

export default {
  title: 'Regression/RenderToCanvas',
  component: Greeting
} satisfies Meta;

// Issue #27: Re-rendering after args changed (controls/docs updates) used to
// reuse the same Ember mount element and crashed with an NPE inside
// renderToCanvas. Every render must go into a fresh mount.
export const ArgsUpdate: StoryObj = {
  args: { name: 'first' },
  play: async (context) => {
    const canvas = createCanvas();
    let unmount: (() => void) | undefined;

    try {
      unmount = await renderTo(
        canvas,
        () => context.unboundStoryFn(context),
        { ...context, args: { name: 'first' }, globals: {} },
        true
      );
      expect(canvas.textContent).toContain('first');

      unmount = await renderTo(
        canvas,
        () => context.unboundStoryFn({ ...context, args: { name: 'second' }, globals: {} }),
        { ...context, args: { name: 'second' }, globals: {} },
        false
      );
      expect(canvas.textContent).toContain('second');
    } finally {
      unmount?.();
      canvas.remove();
    }
  }
};

// Issue #31: A decorator that transforms args via `story(parsedArgs)` must see
// those args reach the actual render. The framework's `render` reports the args
// it received, so renderToCanvas uses them instead of the raw storyContext.args.
export const DecoratedArgs: StoryObj = {
  args: { name: 'there' },
  play: async (context) => {
    const { composeStory } = await import('storybook/preview-api');

    // Inject the decorator at runtime: the vitest transform nulls function
    // values in story exports, which would silently disable the decorator.
    const composed = composeStory(
      {
        args: { name: 'there' },
        decorators: [
          // The Storybook binding spreads the update at the top level of the
          // context, so args changes must be wrapped in `{ args: ... }`.
          (story: (input: unknown) => unknown, { args }: { args: unknown }) =>
            story({ args: { ...(args as Record<string, unknown>), name: 'through-decorator' } })
        ]
      } as never,
      { title: 'Regression/RenderToCanvas', component: Greeting },
      undefined as never,
      undefined as never,
      'DecoratedArgs'
    );

    const result = composed({ name: 'there' });

    expect(result).toMatchObject({ args: { name: 'through-decorator' } });

    const canvas = createCanvas();
    let unmount: (() => void) | undefined;

    try {
      unmount = await renderTo(
        canvas,
        () => composed({ name: 'there' }),
        { ...context, args: { name: 'there' }, globals: {} },
        true
      );
      expect(canvas.textContent).toContain('through-decorator');

      unmount = await renderTo(
        canvas,
        () => composed({ name: 'there' }),
        { ...context, args: { name: 'there' }, globals: {} },
        false
      );
      expect(canvas.textContent).toContain('through-decorator');
    } finally {
      unmount?.();
      canvas.remove();
    }
  }
};

// Issue #30: Rendering without a configured Ember app must fail with a clear,
// actionable message instead of a cryptic NPE.
export const MissingApp: StoryObj = {
  args: { name: 'there' },
  play: async (context) => {
    const canvas = createCanvas();
    const noAppContext = {
      ...context,
      parameters: { ...context.parameters, ember: undefined }
    };

    try {
      await expect(
        renderTo(canvas, () => context.unboundStoryFn(noAppContext), noAppContext, true)
      ).rejects.toThrow(/ember\.app|ember application|configured/i);
    } finally {
      canvas.remove();
    }
  }
};

// Globals changes must flow through `ember.updateGlobals` without a full remount.
export const GlobalsUpdate: StoryObj = {
  args: { name: 'there' },
  play: async (context) => {
    const calls: Record<string, unknown>[] = [];
    const parameters = {
      ...context.parameters,
      ember: {
        ...context.parameters.ember,
        updateGlobals: (globals: Record<string, unknown>) => {
          calls.push(globals);
        }
      }
    };

    const canvas = createCanvas();
    let unmount: (() => void) | undefined;

    try {
      unmount = await renderTo(
        canvas,
        () =>
          context.unboundStoryFn({ ...context, parameters, args: { name: 'there' }, globals: {} }),
        { ...context, parameters, args: { name: 'there' }, globals: {} },
        true
      );
      expect(calls.length).toBe(1);

      unmount = await renderTo(
        canvas,
        () =>
          context.unboundStoryFn({
            ...context,
            parameters,
            args: { name: 'there' },
            globals: { locale: 'de' }
          }),
        { ...context, parameters, args: { name: 'there' }, globals: { locale: 'de' } },
        false
      );

      expect(calls.length).toBe(2);
      expect(calls[1]).toEqual({ locale: 'de' });
      expect(canvas.textContent).toContain('there');
    } finally {
      unmount?.();
      canvas.remove();
    }
  }
};
