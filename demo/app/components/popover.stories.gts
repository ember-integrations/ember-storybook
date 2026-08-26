import { Popover } from './popover.gts';

import type { Meta, StoryObj } from 'ember-storybook';

// Template-only component without signature args — the story-provided
// argTypes below must still show up in docs mode. See issue #45 (Case 2).
export default {
  title: 'Popover',
  component: Popover,
  argTypes: {
    position: {
      name: 'Position',
      options: [
        'top span-right',
        'top',
        'top span-left',
        'right span-bottom',
        'right',
        'right span-top',
        'bottom span-right',
        'bottom',
        'bottom span-left',
        'left span-bottom',
        'left',
        'left span-top'
      ],
      control: {
        type: 'radio'
      }
    }
  }
} satisfies Meta;

export const Default: StoryObj = {
  render: () => <template>
    <Popover>
      Obi<br />
      Wan<br />
      Kenobi!
    </Popover>
  </template>,
  args: {
    position: 'top-start'
  }
};
