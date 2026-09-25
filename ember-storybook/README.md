# Storybook for Ember

Develop, document, and test your UI components in isolation. A workshop for your components.

`ember-storybook` is a [Storybook](https://storybook.js.org) framework for modern Ember apps.

- **Controls from your signatures.** Controls and Signature are generated from the component itself.
- **Stories, tests, docs — one source.** The same story feeds the docs page, the play function, and Vitest
  browser tests.
- **Route stories included.** Templates with `{{outlet}}` are a first-class story type.

## Requirements

- ember v6.8
- storybook v10

## Installation

```sh
pnpm add -D storybook ember-storybook
```

## Getting Started

Add the two config files, then write a story next to your component.

**`.storybook/main.ts`**

```ts
import type { StorybookConfig } from 'ember-storybook';

const config: StorybookConfig = {
  stories: ['../app/**/*.stories.g(j|t)s'],
  framework: 'ember-storybook',
};

export default config;
```

**`.storybook/preview.ts`**

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

An empty App is booted by default, but you can set it yourself — pass an `Application`, an
`ApplicationInstance`, or a factory function returning one.

**`app/components/button.stories.gts`**

```gts
import Button from './button.gts';

import type { Meta, StoryObj } from 'ember-storybook';

export default {
  title: 'Example/Button',
  component: Button,
} satisfies Meta;

export const Basic: StoryObj = {
  args: {
    intent: 'action',
  },
};
```

The component is rendered with every arg passed down as a named argument (`@intent`) — no render function
needed.

Add the scripts and run it:

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

```sh
pnpm storybook
```

## Documentation

Full documentation lives at **[ember-integrations.github.io/ember-storybook](https://ember-integrations.github.io/ember-storybook/)**.

Getting Started

- **[Install & First Story](https://ember-integrations.github.io/ember-storybook/getting-started)** — requirements, install, and the two config files

Guide

- **[Writing Stories](https://ember-integrations.github.io/ember-storybook/guide/writing-stories)** — args, controls, and both CSF dialects (CSF v3 and CSF Next)
- **[Decorators](https://ember-integrations.github.io/ember-storybook/guide/decorators)** — wrap stories with context and layout
- **[Route Stories](https://ember-integrations.github.io/ember-storybook/guide/route-stories)** — stories for route templates and `{{outlet}}`
- **[App Context & Globals](https://ember-integrations.github.io/ember-storybook/guide/context-and-globals)** — `app`, `owner`, `configure`, and `updateGlobals`
- **[Auto-Docs](https://ember-integrations.github.io/ember-storybook/guide/auto-docs)** — docs pages generated from your component signatures
- **[Testing](https://ember-integrations.github.io/ember-storybook/guide/testing)** — turn stories into Vitest browser tests and play functions
- **[Sharing & Deploying](https://ember-integrations.github.io/ember-storybook/guide/sharing)** — build a static Storybook and ship it anywhere
- **[Migrating](https://ember-integrations.github.io/ember-storybook/configuration/migration)** — moving from `@storybook/ember` to `ember-storybook`

Config

- **[`main.ts`](https://ember-integrations.github.io/ember-storybook/configuration/main-ts)** — build configuration and available addons
- **[Ember Parameters](https://ember-integrations.github.io/ember-storybook/configuration/ember-parameters)** — every option under `parameters.ember`

## References

### Ember

- [Ember Guides](https://guides.emberjs.com/) — the official guides
- [Ember API](https://api.emberjs.com/) — `Application`, `ApplicationInstance`, and the rest of the API
- [Glimmer components](https://guides.emberjs.com/release/components/built-in-components/)

### Storybook

- [Storybook](https://storybook.js.org) — homepage
- [Write stories](https://storybook.js.org/docs/writing-stories) — CSF, args, decorators
- [Write tests](https://storybook.js.org/docs/writing-tests) — play functions and `@storybook/addon-vitest`

## License

[MIT](https://github.com/ember-integrations/ember-storybook/blob/main/LICENSE)
