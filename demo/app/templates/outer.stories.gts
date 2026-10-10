import { OutletPlaceholder } from 'ember-storybook';
import { expect } from 'storybook/test';

import Outer from '#app/templates/outer.gts';

import type { Meta, StoryObj } from 'ember-storybook';

// Route templates need special handling: `{{outlet}}` has to render a *child*
// route, and a story has no router to supply one. ember-storybook renders route
// stories through whichever outlet backend the Ember build provides — Ember's
// own outlet root on classic builds (`view:-outlet`), or the `@outlet` argument
// on RFC 1099 route rendering (ember-source >= 7.5.0-alpha.2) — so rendering
// `Outer` through a plain component story never touches the outlet machinery.
// Since #62 an `{{outlet}}` template is also detected *without* any annotation
// (see `outer-unannotated.stories.gts`); `parameters.ember.route` is what
// supplies the route data the implicit fallback has none of — `model`,
// `controller`, and what the outlet renders.
//
// There is no routing here: the nested route (`templates/outer/nested.gts`,
// reachable at `/outer/nested` in the demo app) is deliberately *not* injected.
// What `{{outlet}}` renders is chosen by the **Ember** toolbar menu (`hole` or
// `placeholder`); an explicit `route.outlet` below overrides that menu.
//
// The route template receives `@model` / `@controller` — exactly as under the
// real router — which is why the story drives it through `args.model`.
export default {
  title: 'Routes/Outer',
  component: Outer,
  args: {
    model: { title: 'Outer route reached from a story' }
  },
  parameters: {
    ember: {
      route: {}
    }
  }
} satisfies Meta;

// Follows the Ember toolbar menu: hole by default, a marker when switched.
// This is the story to toggle the menu on.
export const GlobalOutlet: StoryObj = {};

// Pinned so its assertions hold whatever the toolbar is set to.
export const EmptyOutlet: StoryObj = {
  globals: {
    outlet: 'hole'
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector(':scope [data-test-outer-route]')).not.toBeNull();
    // The model reaches the route template as `@model`.
    await expect(canvasElement.textContent).toContain('Outer route reached from a story');
    // The hole is really empty: neither the nested route nor any placeholder.
    await expect(canvasElement.querySelector(':scope [data-test-nested-route]')).toBeNull();
    await expect(canvasElement.querySelector(':scope [data-storybook-outlet]')).toBeNull();
  }
};

// The same hole, marked by the framework's placeholder component.
export const PlaceholderOutlet: StoryObj = {
  globals: {
    outlet: 'placeholder'
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector(':scope [data-test-outer-route]')).not.toBeNull();

    const placeholder = canvasElement.querySelector(':scope [data-storybook-outlet]');

    // No model given for the stub, so it labels itself "outlet".
    await expect(placeholder?.textContent.trim()).toBe('outlet');
    // Still not the real nested route — just the marker.
    await expect(canvasElement.querySelector(':scope [data-test-nested-route]')).toBeNull();
  }
};

// The `string` form: the placeholder labeled with the string. An explicit stub
// is author intent: it renders even though the menu says hole.
export const MarkedOutlet: StoryObj = {
  globals: {
    outlet: 'hole'
  },
  parameters: {
    ember: {
      route: {
        outlet: 'nested'
      }
    }
  },
  play: async ({ canvasElement }) => {
    const placeholder = canvasElement.querySelector(':scope [data-storybook-outlet]');

    await expect(placeholder?.textContent.trim()).toBe('nested');
    await expect(canvasElement.querySelector(':scope [data-test-nested-route]')).toBeNull();
  }
};

// The component form: `outlet` *is* the component Ember hands to
// `{{outlet}}`/`<@outlet />`. Passed bare, the placeholder has no `@model` and
// falls back to its own label.
export const ComponentOutlet: StoryObj = {
  globals: {
    outlet: 'hole'
  },
  parameters: {
    ember: {
      route: {
        outlet: OutletPlaceholder
      }
    }
  },
  play: async ({ canvasElement }) => {
    const placeholder = canvasElement.querySelector(':scope [data-storybook-outlet]');

    await expect(placeholder?.textContent.trim()).toBe('outlet');
  }
};

// Inline `<template>`s work too — this one contains its own `{{outlet}}`,
// which must stay a hole: stubbing is one level deep.
export const NestedStubOutlet: StoryObj = {
  globals: {
    outlet: 'hole'
  },
  parameters: {
    ember: {
      route: {
        outlet: <template>
          <span data-test-stub-level>stub</span>
          {{outlet}}
        </template>
      }
    }
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector(':scope [data-test-stub-level]')?.textContent).toBe(
      'stub'
    );
    // The stub's own outlet renders nothing: no placeholder, no nested route.
    await expect(canvasElement.querySelector(':scope [data-storybook-outlet]')).toBeNull();
    await expect(canvasElement.querySelector(':scope [data-test-nested-route]')).toBeNull();
  }
};
