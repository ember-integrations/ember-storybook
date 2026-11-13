import { expect, fn } from 'storybook/test';

import preview from '../../.storybook/preview';
import Button from './button.gts';

const meta = preview.meta({
  title: 'Example/Button',
  component: Button,
  // The order below is intentional (and deliberately neither alphabetical nor
  // source order): user-defined argTypes must keep the order the author
  // defined, both in the Controls panel and the docs Controls block.
  argTypes: {
    label: { control: 'text' },
    // Kept as an empty object to preserve order while inheriting control and options from the signature.
    size: {},
    primary: { control: 'boolean' },
    backgroundColor: { control: 'color' },
    push: { action: 'push' }
  },
  // Use `fn` to spy on the push arg, which appears in the actions panel once invoked.
  args: { push: fn() }
});

export const Primary = meta.story({
  args: {
    label: 'Button',
    primary: true,
    size: 'medium'
  }
});

// Regression: merged argTypes must be keyed user-first (meta order), never
// alphabetically pre-sorted by the framework enhancer.
// eslint-disable-next-line unicorn/no-top-level-side-effects -- CSF Next attaches tests to stories
Primary.test('merges argTypes user-first', async ({ argTypes }) => {
  await expect(Object.keys(argTypes)).toEqual([
    'label',
    'size',
    'primary',
    'backgroundColor',
    'push'
  ]);
});

// Regression: enum args extracted from the signature must expose `options` at
// the top level of the argType so Storybook's select control is populated.
// eslint-disable-next-line unicorn/no-top-level-side-effects -- CSF Next attaches tests to stories
Primary.test('extracts enum options at the top level of argType', async ({ argTypes }) => {
  await expect(argTypes.size).toMatchObject({
    control: { type: 'select' },
    options: ['small', 'medium', 'large']
  });
});

// eslint-disable-next-line unicorn/no-top-level-side-effects -- CSF Next attaches tests to stories
Primary.test('calls push when clicked', async ({ canvas, userEvent, args }) => {
  const button = await canvas.findByRole('button');

  await userEvent.click(button);

  await expect(args.push).toHaveBeenCalled();
});

export const Secondary = meta.story({
  // Overriding only `control` switches the UI widget while preserving the
  // enum `options` extracted from the component signature.
  argTypes: {
    size: { control: { type: 'inline-radio' } }
  },
  args: {
    label: 'Buttons',
    primary: false,
    size: 'large'
  }
});

// eslint-disable-next-line unicorn/no-top-level-side-effects -- CSF Next attaches tests to stories
Secondary.test(
  'preserves signature enum options when overriding control type',
  async ({ argTypes }) => {
    await expect(argTypes.size).toMatchObject({
      control: { type: 'inline-radio' },
      options: ['small', 'medium', 'large']
    });
  }
);

// `.extend()` reuses `Primary` and overrides a single arg.
/* eslint-disable ember/avoid-leaking-state-in-ember-objects -- Storybook's `.extend()`, not Ember's `Klass.extend()` */
export const Small = Primary.extend({
  args: {
    size: 'small'
  }
});
/* eslint-enable ember/avoid-leaking-state-in-ember-objects */
