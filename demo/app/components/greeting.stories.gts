import type { Meta, StoryObj } from 'ember-storybook';

import { Greeting } from './greeting.gts';

export default {
  title: 'Greetings',
  component: Greeting,
  parameters: {
    layout: 'fullscreen',
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
  render: (args) => <template>
    <Greeting @name={{args.name}} />
  </template>
}

export const RTL: StoryObj = {
  render: (args) => <template>
    <Greeting @name={{args.name}} dir="rtl"/>
  </template>
}

export const Plain: StoryObj = {};