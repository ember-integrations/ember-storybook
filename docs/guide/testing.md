# Testing

Stories can be tested with AAA - Arrange, Act, Assert.
The story itself arranges the scene, you add acting and assertions.

## Vitest Browser Tests

The [`@storybook/addon-vitest`](https://storybook.js.org/docs/writing-tests) addon runs all
your stories through Vitest in a real browser (Playwright), including their play functions, which functions contains the test code.

::: code-group

```sh [pnpm]
pnpm exec storybook add @storybook/addon-vitest
```

```sh [npm]
npx storybook add @storybook/addon-vitest
```

```sh [yarn]
yarn storybook add @storybook/addon-vitest
```

```sh [bun]
bun x storybook add @storybook/addon-vitest
```

:::

The wizard wires up a Vitest _project_ in your `vite.config.js`:

```ts [vite.config.js]
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // ...
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
            storybookScript: 'pnpm storybook --no-open',
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
```

Tag your stories so the addon picks them up — in `preview.ts`:

```ts [.storybook/preview.ts]
export default {
  tags: ['vitest'],
}
```

Run them like any Vitest suite.

### Large Story Suites

Vite pre-bundles a dependency the first time it sees it. In a large suite it can find one
partway through the run, reload the page, and the run fails. Scan the preview and every story
up front, and pre-bundle modules that are only ever imported lazily (such as `axe-core`, which
`@storybook/addon-a11y` loads on demand). On a cold cache that pre-bundling can take longer
than Vitest's default 60 s browser connect timeout, so raise it too:

```ts [vite.config.js]
{
  extends: true,
  plugins: [storybookTest({ /* ... */ })],
  optimizeDeps: {
    entries: ['.storybook/preview.ts', 'app/**/*.stories.{gjs,gts}'],
    include: ['@storybook/addon-a11y > axe-core'],
  },
  test: {
    name: 'storybook',
    browser: {
      connectTimeout: 180_000,
      // ...
    },
  },
}
```

### Decorators in `.ts` Files

`@embroider/vite` compiles TypeScript with Babel and turns Vite's own TypeScript transform
(oxc) off, but only when nothing has configured it yet. Vitest configures it first, so under
Vitest decorators in plain `.ts` files (e.g. `@tracked` in a service) are compiled by oxc and
stop working. Turn oxc off in the Storybook project (on Vite 7 and earlier, set `esbuild: false`
instead):

```ts [vite.config.js]
{
  extends: true,
  plugins: [storybookTest({ /* ... */ })],
  oxc: false,
  // ...
}
```

## Interaction Tests

The `play` function is where a story describes behavior: query the canvas, fire events,
assert the result.

:::csf field.stories.gts

== CSF v3

```gts
import { expect, fn } from 'storybook/test';

import Field from './field.gts';

import type { Meta, StoryObj } from 'ember-storybook';

export default {
  title: 'Form/Field',
  component: Field
} satisfies Meta;

export const Default: StoryObj = {
  args: {
    submit: fn()
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: 'Title' }), 'abc');
    await expect(canvas.getByRole('textbox', { name: 'Slug' })).toHaveValue('abc');

    await userEvent.click(canvas.getByRole('button', { name: 'Catalog' }));
    await expect(args.submit).toBeCalled();
  }
};
```

== CSF-next 🧪

`Story.test()` attaches tests to the story itself:

```gts
import { expect, fn } from 'storybook/test';

import preview from '#storybook/preview';
import Field from './field.gts';

const meta = preview.meta({
  title: 'Form/Field',
  component: Field
});

export const Default = meta.story({
  args: {
    submit: fn()
  }
});

Default.test('derives the slug from the title', async ({ canvas, userEvent }) => {
  await userEvent.type(canvas.getByRole('textbox', { name: 'Title' }), 'abc');
  await expect(canvas.getByRole('textbox', { name: 'Slug' })).toHaveValue('abc');
});
```

:::

A play function doubles as living documentation for the interaction — anyone can watch it run in the browser.

## Visual Regression

Options that play well with this stack, from the slides' toolkit:

- [Chromatic](https://www.chromatic.com/) — Storybook's own, snapshots every story
- [Vitest visual regression](https://vitest.dev/guide/browser/visual-regression-testing.html)
  — snapshots inside the browser tests above

## Continuous Integration

As your storybook is injected as a project in `vite.config.ts`, you can run vitest from CLI and thus run it on your CI system:

::: code-group

```sh [pnpm]
pnpm vitest
```

```sh [npm]
npm vitest
```

```sh [yarn]
yarn vitest
```

```sh [bun]
bun vitest
```

:::

## Limits Worth Knowing

- Route stories render in the canvas only; portable rendering of them is not supported
  (see [Route Stories](/guide/route-stories)).
- Switching between a component story and a route story remounts the Ember application —
  state does not carry over.
