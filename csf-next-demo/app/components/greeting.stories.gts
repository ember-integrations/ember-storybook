import { expect } from 'storybook/test';

import preview from '../../.storybook/preview';
import { Greeting } from './greeting.gts';

const meta = preview.meta({
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
});

export const LTR = meta.story({
  render: (args) => <template><Greeting @name={{args.name}} /></template>
});

export const RTL = meta.story({
  render: (args) => <template><Greeting @name={{args.name}} dir="rtl" /></template>
});

export const Plain = meta.story();

// https://github.com/ember-integrations/ember-storybook/issues/48
// `name` is required in the signature, but the story's `argTypes` provide a
// partial `type` (no `required`). The merged argTypes must keep
// `type.required: true` so Storybook renders the required asterisk.
// eslint-disable-next-line unicorn/no-top-level-side-effects -- CSF Next attaches tests to stories
Plain.test('keeps required arg types from the component signature', async ({ argTypes }) => {
  await expect(argTypes.name.type?.required).toBe(true);
});
