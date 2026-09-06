import { expect } from 'storybook/test';

import Outer from '#app/templates/outer.gts';

import type { Meta, StoryObj } from 'ember-storybook';

// Regression guard for #62: a route template (its `{{outlet}}` crashes
// `renderComponent`) used as a story component *without* the
// `parameters.ember.route` annotation. Sportipedia hit this with page stories
// whose template renders `{{outlet}}`; the outlet keyword then threw
// "Cannot destructure property 'tag' of 'ref' as it is undefined."
//
// The renderer must detect the `{{outlet}}` in the template and mount it
// through Ember's outlet root anyway, exactly like `Routes/Outer` does — with
// `{{outlet}}` following the Ember toolbar global (hole by default).
export default {
  title: 'Routes/Outer Unannotated',
  component: Outer
} satisfies Meta;

export const Default: StoryObj = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector(':scope [data-test-outer-route]')).not.toBeNull();
    // No route annotation: no model is handed to the template.
    await expect(canvasElement.querySelector(':scope [data-test-outer-model]')).toBeNull();
    // The outlet renders a hole, and the app is not left half-booted.
    await expect(canvasElement.querySelector(':scope [data-test-nested-route]')).toBeNull();
  }
};
