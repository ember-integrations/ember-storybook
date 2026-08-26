import { expect } from 'storybook/test';

import { Greeting } from './greeting.gts';

import type { Meta, StoryObj } from 'ember-storybook';

export default {
  title: 'Greetings',
  component: Greeting,
  parameters: {
    layout: 'fullscreen'
  },
  argTypes: {
    name: {
      type: 'string'
    }
  },
  args: {
    name: 'there'
  }
} satisfies Meta;

export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};

export const RTL: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} dir="rtl" /></template>
};

export const Plain: StoryObj = {
  // https://github.com/ember-integrations/ember-storybook/issues/48
  // `name` is required in the signature, but the story's `argTypes` provide a
  // partial `type` (no `required`). The merged argTypes must keep
  // `type.required: true` so Storybook renders the required asterisk.
  play: async (context) => {
    await expect(context.argTypes.name?.type?.required).toBe(true);
  }
};
