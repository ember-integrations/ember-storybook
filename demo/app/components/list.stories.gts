import { fn } from 'storybook/test';

import { List } from './list.gts';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories
export default {
  title: 'List',
  component: List,
  args: { update: fn(), activateItem: fn() }
};

export const Demo = {
  render: () => <template>
    <List as |l|>
      <l.Option @value="banana">Banana</l.Option>
      <l.Option @value="apple">Apple</l.Option>
      <l.Option @value="peach">Peach</l.Option>
    </List>
  </template>
};
