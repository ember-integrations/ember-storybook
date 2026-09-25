# Migrating From `@storybook/ember`

The official `@storybook/ember` was build for Ember v3 for classic build (with webpack).
Storybook v10 makes vite the default renderer, which `@storybook/ember` does not support, making it incompatible.
Together with the Storybook we discussed the future for this project and decided to move it into `ember-storybook`.
The two packages support two generations of ember and storybook (see the table below).

This guide helps you step-by-step to migrate from `@storyboo/ember` to `ember-storybook`.

| `@storybook/ember`            | `ember-storybook`       |
| ----------------------------- | ----------------------- |
| Ember v3                      | Ember v6.8              |
| Storybook < 10                | Storybook v10           |
| Classic Build only            | Vite                    |
| Requires an Ember app running | Spins up an App for you |

## Step by Step

### 1. Swap the Packages

::: code-group

```sh [pnpm]
pnpm remove @storybook/ember && pnpm add -D storybook ember-storybook
```

```sh [npm]
npm uninstall @storybook/ember && npm install -D storybook ember-storybook
```

```sh [yarn]
yarn remove @storybook/ember && yarn add -D storybook ember-storybook
```

```sh [bun]
bun remove @storybook/ember && bun add -d storybook ember-storybook
```

:::

Storybook 10 is required — run the upgrade first if you're on an older Storybook:

::: code-group

```sh [pnpm]
pnpm dlx storybook@latest upgrade
```

```sh [npm]
npx storybook@latest upgrade
```

```sh [yarn]
yarn dlx storybook@latest upgrade
```

```sh [bun]
bun x storybook@latest upgrade
```

:::

### 2. Rewrite `main.ts`

Remove the legacy `ember` block (its `configDir`/`scripts`/`styles` keys have no
equivalents), change the framework name, and keep `stories`:

```ts [.storybook/main.ts]
import type { StorybookConfig } from 'ember-storybook';

const config: StorybookConfig = {
  stories: ['../app/**/*.stories.g(j|t)s'],

  framework: 'ember-storybook',
};

export default config;
```

### 3. Point the Preview at Your App

The app entry you used to list under `scripts` becomes a factory under `parameters.ember.app`:

```ts [.storybook/preview.ts]
import { createApp } from '#app/app';
import { configure } from '#app/config';

import type { Preview } from 'ember-storybook';

const preview: Preview = {
  parameters: {
    ember: {
      app: createApp,
      configure,
    },
  },
};

export default preview;
```

- `scripts: ['../app/app.js']` → `app` (export a `createApp()` from your app module that
  returns a non-autobooting instance; see [Getting Started](/getting-started))
- `configDir: 'config/environment.js'` → startup config code goes in `configure`
- `styles: ['../app/styles/app.css']` → import the stylesheet in `preview.ts`; it applies
  to every story

### 4. Migrate Your Stories

CSF is CSF: `title`, named story exports, args, argTypes, decorators, parameters — none of
that changes. What changes is _how a story renders_, and you can migrate file by file:
add the new `button.stories.gts` alongside the legacy `button.stories.ts` — the `stories`
glob in `main.ts` controls which set is live, so both can coexist until you delete the old
ones.

This is the pattern from the [Hokulea design system](https://github.com/hokulea/hokulea) (migrated in [#623](https://github.com/hokulea/hokulea/pull/623)),
which migrated its stories side by side:

```ts [button.stories.ts (before) ~vscode-icons:file-type-typescript~]
import { hbs } from 'ember-cli-htmlbars';

import { action } from 'storybook/actions';

export default {
  title: 'Actions/Button',
  component: 'button', // resolved from the app's registry by name
};

export const Showcase = {
  render: (args) => ({
    template: hbs`
      <Button
        @push={{this.push}}
        @intent={{this.intent}}
        @disabled={{this.disabled}}
      >
        {{this.label}}
      </Button>
    `,
    context: {
      ...args,
      disabled: parseOptionalBooleanArg(args.disabled),
      push: action('button pushed'),
    },
  }),
  args: {
    label: 'Button',
  },
};
```

```gts [button.stories.gts (after) ~vscode-icons:file-type-glimmer~]
import { action } from 'storybook/actions';

import { Button } from './button.gts';

import type { Meta, StoryObj } from 'ember-storybook';

export default {
  title: 'Actions/Button',
  component: Button
} satisfies Meta;

export const Showcase: StoryObj = {
  render: (args) => <template>
    <Button
      @push={{args.push}}
      @intent={{args.intent}}
      @disabled={{args.disabled}}
    >
      {{args.label}}
    </Button>
  </template>,
  args: {
    label: 'Button',
    push: action('button pushed')
  },
  decorators: [(story, { args }) => story({ args: parseArgs(args) })]
};
```

The mechanical rules:

1. **Rename the file** to `.stories.gts` — the template tag needs gjs/gts.
2. **Import the component.** `component: 'button'` (a registry string, resolved by the
   running app) becomes `component: Button` with an explicit import.
3. **Drop `ember-cli-htmlbars`.** The `render` function that returned a
   `{ template: hbs, context }` object becomes an inline template:
   `render: (args) => <template>…</template>`, and <code v-pre>{{this.foo}}</code>
   references become <code v-pre>{{args.foo}}</code>.
4. **Move `context` into args or a decorator.** Spies like `action('button pushed')` go
   straight into `args`; pre-computed values (icons, fixtures) become module-level consts;
   arg normalization (e.g. coercing the control panel's `"true"` string to a boolean)
   becomes a decorator that re-renders the story with parsed args.
5. **Type your stories.** `import type { Meta, StoryObj } from 'ember-storybook'` replaces
   the untyped (or `@storybook/ember`-typed) exports — `satisfies Meta` on the default
   export, `StoryObj<Args>` on the stories.
6. **Delete what's now free.** Legacy `parameters.options.showPanel` workarounds and large
   hand-written `argTypes` often fall away: argTypes and the docs signature are derived
   from component types (see [Auto Docs](/guide/auto-docs)).

### 5. Expect These Behavior Differences

- **No router.** The old app-served model had your app's router alive; here nothing boots it
  (see `configure`). For template-level <code v-pre>{{outlet}}</code> use route stories, for URL-driven code
  pass args in.
- **Services are real.** If a service hits the network, it hits the network — add MSW or
  stub via `owner`.
