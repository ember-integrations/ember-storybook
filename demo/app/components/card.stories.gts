import { CardExport as CardComponent } from './card.gts';

import type { Meta, StoryObj } from 'ember-storybook';

export default {
  title: 'Card',
  component: CardComponent
} satisfies Meta;

export const Default: StoryObj = {
  render: () => <template>
    {{! @glint-ignore }}
    <CardComponent>
      Sample Card Content
    </CardComponent>
  </template>
};

export const Builder: StoryObj = {
  render: () => <template>
    {{! @glint-ignore }}
    <CardComponent>
      <:header>Card Title</:header>
      <:body>Sample Card Content</:body>
      <:footer>Footer</:footer>
    </CardComponent>
  </template>
};
