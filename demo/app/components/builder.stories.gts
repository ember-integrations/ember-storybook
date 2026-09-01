import { Builder } from './builder.gts';

import type { Meta, StoryObj } from 'ember-storybook';

const meta: Meta = {
  title: 'Example/Builder',
  component: Builder,
  tags: ['autodocs']
};

export default meta;

export const Demo: StoryObj = {
  render: () => <template>
    <Builder as |b|>
      <b.Item>One</b.Item>
      <b.Item>Two</b.Item>
    </Builder>
  </template>
};
