import { expect, fn } from 'storybook/test';

import Button from './button.gts';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories
export default {
  title: 'Example/Button',
  component: Button,
  // The order below is intentional (and deliberately neither alphabetical nor
  // source order): user-defined argTypes must keep the order the author
  // defined, both in the Controls panel and the docs Controls block.
  argTypes: {
    label: { control: 'text' },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large']
    },
    primary: { control: 'boolean' },
    backgroundColor: { control: 'color' },
    push: { action: 'push' }
  },
  // Use `fn` to spy on the onClick arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#story-args
  args: { push: fn() }
};

export const Primary = {
  args: {
    label: 'Button',
    primary: true,
    size: 'medium'
  },
  play: async (context) => {
    // Regression: merged argTypes must be keyed user-first (meta order),
    // never alphabetically pre-sorted by the framework enhancer.
    await expect(Object.keys(context.argTypes)).toEqual([
      'label',
      'size',
      'primary',
      'backgroundColor',
      'push'
    ]);
  }
};

export const Secondary = {
  args: {
    label: 'Buttons',
    primary: false,
    size: 'large'
  }
};
