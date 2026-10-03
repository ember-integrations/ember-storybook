import { expect } from 'storybook/test';

import preview from '../../.storybook/preview';
import Button from './button.gts';
import { Greeting } from './greeting.gts';

// Regression fixture for CSF `subcomponents`: Storybook's Controls/ArgTypes
// blocks build a tab per subcomponent through `parameters.docs.extractArgTypes`,
// and the docs page threw "Args unsupported" when the framework lacked it.
const meta = preview.meta({
  title: 'Subcomponents',
  component: Greeting,
  subcomponents: { Button },
  args: { name: 'there' }
});

export const Default = meta.story();

// eslint-disable-next-line unicorn/no-top-level-side-effects -- CSF Next attaches tests to stories
Default.test('extracts the args of a subcomponent', async ({ parameters }) => {
  const extractArgTypes = (
    parameters.docs as { extractArgTypes: (component: unknown) => Record<string, unknown> }
  ).extractArgTypes;

  await expect(extractArgTypes(Button)).toHaveProperty('label');
  await expect(extractArgTypes(Button)).toHaveProperty('size');
});

// eslint-disable-next-line unicorn/no-top-level-side-effects -- CSF Next attaches tests to stories
Default.test('labels the main component tab with its story-file name', async () => {
  await expect((Greeting as { __docgenInfo?: unknown }).__docgenInfo).toEqual({
    displayName: 'Greeting'
  });
});
