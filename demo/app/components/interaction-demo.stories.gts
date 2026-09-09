import { expect, userEvent, waitFor, within } from 'storybook/test';

import InteractionDemo from './interaction-demo.gts';

import type { Meta, StoryObj } from 'ember-storybook';

/**
 * Classic-CSF port of the csf-next-demo guard component: stateful playground
 * for the Interaction Recorder. The `play` function is the code the recorder
 * generated (recorded, saved, and adapted) — the Interaction Recorder itself
 * is exercised manually; the renderer's no-remount-on-globals-change guard
 * lives in `csf-next-demo` (`.test()` attachment is CSF Next only).
 */
const meta: Meta = {
  title: 'Example/InteractionDemo',
  component: InteractionDemo,
  argTypes: {
    initialCount: { control: 'number' }
  },
  args: {
    initialCount: 0
  }
};

export default meta;

export const Default: StoryObj = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);

    await userEvent.click(await canvas.findByRole('button', { name: 'Increment' }));
    await userEvent.type(await canvas.findByRole('textbox', { name: 'Name' }), 'John Doe');
    await userEvent.click(await canvas.findByRole('checkbox', { name: 'Send notifications' }));
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('1'));
  }
};
