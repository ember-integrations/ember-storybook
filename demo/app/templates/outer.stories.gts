import { OutletPlaceholder } from 'ember-storybook';
import { expect } from 'storybook/test';

import Outer from '#app/templates/outer.gts';

import type { Meta, StoryObj } from 'ember-storybook';

// Route templates are the one kind of template a component story cannot render
// as-is: `{{outlet}}` looks up its child route in Glimmer's *dynamic scope*, and
// `renderComponent` never populates that scope, so rendering `Outer` directly
// throws. Setting `parameters.ember.route` tells the renderer to mount the story
// through Ember's own outlet root instead — the same view `Router` uses — which
// makes `{{outlet}}` resolve normally.
//
// There is no routing here: the nested route (`templates/outer/nested.gts`,
// reachable at `/outer/nested` in the demo app) is deliberately *not* injected.
// What `{{outlet}}` renders is chosen by the **Ember** toolbar menu (`hole` or
// `placeholder`); an explicit `route.outlet` below overrides that menu.
//
// The route template receives only `@model` / `@controller` — exactly as under
// the real router — which is why the story drives it through `args.model`.
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

// An explicit stub is author intent: it renders even though the menu says hole.
export const MarkedOutlet: StoryObj = {
  globals: {
    outlet: 'hole'
  },
  parameters: {
    ember: {
      route: {
        outlet: {
          name: 'nested',
          template: OutletPlaceholder,
          model: 'nested'
        }
      }
    }
  },
  play: async ({ canvasElement }) => {
    const placeholder = canvasElement.querySelector(':scope [data-storybook-outlet]');

    await expect(placeholder?.textContent.trim()).toBe('nested');
    await expect(canvasElement.querySelector(':scope [data-test-nested-route]')).toBeNull();
  }
};
