# main.ts

The build-side configuration. Everything here runs in Node while Storybook boots or builds.

## Minimal

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

`defineMain` is a typed identity helper — same config, but the CSF Next entry point wants a
default export.

## Other Storybook Options

Everything else in `StorybookConfig` (`docs`, `refs`, `staticDir`, `features`, `core`) is
plain Storybook — see the
[main.ts config reference](https://storybook.js.org/docs/api/main-config/main-config).
