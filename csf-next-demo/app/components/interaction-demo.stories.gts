import { renderSettled } from '@ember/renderer';
import { run } from '@ember/runloop';

import { renderToCanvas } from 'ember-storybook';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { createApp } from '#app/app.ts';

import preview from '../../.storybook/preview';
import InteractionDemo from './interaction-demo.gts';

const meta = preview.meta({
  title: 'Example/InteractionDemo',
  component: InteractionDemo,
  argTypes: {
    initialCount: { control: 'number' }
  }
});

export const Default = meta.story({
  args: {
    initialCount: 0
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);

    await userEvent.click(await canvas.findByRole('button', { name: 'Increment' }));
    await userEvent.type(await canvas.findByRole('textbox', { name: 'Name' }), 'John Doe');
    await userEvent.click(await canvas.findByRole('checkbox', { name: 'Send notifications' }));
    await waitFor(() => expect(canvas.queryByRole('status')).toBeVisible());
  }
});

const storyFn = () => ({ component: InteractionDemo, args: { initialCount: 0 } });

// Regression: the Interaction Recorder toggles its mode through globals
// (`storybook-addon-test-codegen/is-recording`), and a globals-only re-render
// must never tear the mounted component down — that would wipe its `@tracked`
// state mid-recording.
// eslint-disable-next-line unicorn/no-top-level-side-effects -- CSF Next attaches tests to stories
Default.test('keeps component state across a globals-only re-render', async () => {
  // Detached on purpose: the story under test already owns `document.body` as
  // its app root, and Ember asserts against mounting a second app root inside
  // an existing one.
  const host = document.createElement('div');

  const renderContext = (globals: Record<string, unknown>) =>
    ({
      storyFn,
      showMain: () => {
        /* the detached host is not managed by Storybook; nothing to reveal */
      },
      forceRemount: false,
      storyContext: {
        id: 'example-interactiondemo--default',
        name: 'Default',
        args: { initialCount: 0 },
        globals,
        parameters: {
          ember: { app: (options?: Record<string, unknown>) => createApp(options) }
        }
      }
    }) as unknown as Parameters<typeof renderToCanvas>[0];

  const unmount = await renderToCanvas(renderContext({ 'test/flag': 1 }), host);

  const button = host.querySelector<HTMLButtonElement>(':scope #interaction-demo-increment');

  // eslint-disable-next-line ember/no-runloop -- plain DOM click must land in a run loop
  run(() => button?.click());
  await renderSettled();

  const mount = host.firstElementChild;

  await expect(mount?.textContent).toContain('Count: 1');

  await renderToCanvas(renderContext({ 'test/flag': 2 }), host);

  await expect(host.firstElementChild).toBe(mount);
  await expect(mount?.textContent).toContain('Count: 1');

  unmount();
});

// Recorded with the Interaction Recorder: after the story's play (which
// increments once) three more clicks must bring the counter to 4.
// eslint-disable-next-line unicorn/no-top-level-side-effects -- CSF Next attaches tests to stories
Default.test('Count to 4', async ({ canvasElement }) => {
  const canvas = within(canvasElement.ownerDocument.body);

  await userEvent.click(await canvas.findByRole('button', { name: 'Increment' }));
  await userEvent.click(await canvas.findByRole('button', { name: 'Increment' }));
  await userEvent.click(await canvas.findByRole('button', { name: 'Increment' }));

  await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('4'));
});
