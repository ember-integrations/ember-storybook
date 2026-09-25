# Getting Started

A brief introduction setting up ember and storybook.

## Requirements

| Package        | Version   |
| -------------- | --------- |
| `ember-source` | `>=6.8.0` |
| `storybook`    | `^10.0.0` |

Your app should be an Ember app built with Vite.

> [!NOTE]
> `storybook init` does not yet know about this framework. Setting up takes one install and two
> config files, so let's do it by hand — it's faster anyway.

## Install

::: code-group

```sh [pnpm]
pnpm add -D storybook ember-storybook
```

```sh [npm]
npm install -D storybook ember-storybook
```

```sh [yarn]
yarn add -D storybook ember-storybook
```

```sh [bun]
bun add -d storybook ember-storybook
```

:::

## Configuration

The config lives in `.storybook/`. `main.ts` configures the build, `preview.ts` configures
what runs inside the preview iframe.

:::csf .storybook/main.ts

== CSF v3

```ts
import type { StorybookConfig } from 'ember-storybook';

const config: StorybookConfig = {
  stories: ['../app/**/*.stories.g(j|t)s'],

  framework: 'ember-storybook',
};

export default config;
```

== CSF-next 🧪

```ts
import { defineMain } from 'ember-storybook/node';

export default defineMain({
  stories: ['../app/**/*.stories.g(j|t)s'],

  framework: 'ember-storybook',
});
```

:::

:::csf .storybook/preview.ts

== CSF v3

```ts
import { createApp } from '../app/app';

import type { Preview } from 'ember-storybook';

const preview: Preview = {
  parameters: {
    ember: {
      app: createApp,
    },
  },
};

export default preview;
```

== CSF-next 🧪

```ts
import { createApp } from '../app/app';
import { definePreview } from 'ember-storybook';

export default definePreview({
  parameters: {
    ember: {
      app: createApp,
    },
  },
});
```

:::

Ember specific configuration is set in `parameters.ember.app`.
By default an empty App is booted for you, but you can set this for yourself.

- an `Application` or `ApplicationInstance` class
- a factory function returning one of those

All other Ember options (`configure`, `owner`, `updateGlobals`) are covered in
[App Context & Globals](/guide/context-and-globals).

## Add the Scripts

```json [package.json]
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

## Write Your First Story

Colocate stories next to the component: `button.stories.gts` beside `button.gts`.

:::csf button.stories.gts

== CSF v3

```gts
import Button from './button.gts';

import type { Meta, StoryObj } from 'ember-storybook';

export default {
  title: 'Example/Button',
  component: Button
} satisfies Meta;

export const Primary: StoryObj = {
  args: {
    intent: 'action'
  }
};
```

== CSF-next 🧪

```gts
import preview from '#storybook/preview';
import Button from './button.gts';

const meta = preview.meta({
  title: 'Example/Button',
  component: Button
});

export const Primary = meta.story({
  args: {
    intent: 'action'
  }
});
```

:::

That's it. The `component` is rendered with every arg passed down as a named argument —
`@intent` — no render function needed. When you need full control over how the
component is invoked (positional args, blocks, wrappers), give the meta an explicit
`render` template:

```gts [button.stories.gts]
import Button from './button.gts';

import type { Meta } from 'ember-storybook';

export default {
  title: 'Example/Button',
  component: Button,
  render: (args) => <template>
    <Button @intent={{args.intent}}>
      {{args.label}}
    </Button>
  </template>
} satisfies Meta;
```

## Run It

::: code-group

```sh [pnpm]
pnpm storybook
```

```sh [npm]
npm run storybook
```

```sh [yarn]
yarn storybook
```

```sh [bun]
bun run storybook
```

:::

Open `http://localhost:6006` in your browser. Edit the story or the component and the canvas
updates.

## Where to Go Next

- [Writing Stories](/guide/writing-stories) — args, controls, and both CSF dialects
- [Auto-Docs](/guide/auto-docs) — docs pages generated from your component signatures
- [Decorators](/guide/decorators) — wrap stories with context and layout
- [Route Stories](/guide/route-stories) — templates with <code v-pre>{{outlet}}</code>
- [Testing](/guide/testing) — turn stories into browser tests
