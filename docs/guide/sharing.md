# Sharing & Deploying

A built Storybook is a static site. That makes it a natural artifact: build it in CI, ship
it to any host, and point your team — and the design review — at a URL.

## Build

::: code-group

```sh [pnpm]
pnpm build-storybook
```

```sh [npm]
npm run build-storybook
```

```sh [yarn]
yarn build-storybook
```

```sh [bun]
bun run build-storybook
```

:::

The output lands in `storybook-static/` and deploys anywhere static files live. Storybook's
[Publish Storybook](https://storybook.js.org/docs/sharing/publish-storybook) guide covers
the hosts, CI recipes, and access control.

## Side-by-Side: Refs

Building a product on top of a design system? `refs` embed the other Storybook into yours —
one sidebar, one search, two codebases. This is how an app shows its library without
importing a single component:

```ts [.storybook/main.ts]
import type { StorybookConfig } from 'ember-storybook';

const config: StorybookConfig = {
  // ...
  refs: {
    hokulea: {
      title: 'Hokulea',
      url: 'https://hokulea.netlify.app/ember/',
      expanded: false
    }
  }
};
```

Your stories keep working as before; the library's stories are a click away, rendered from
their own deployed Storybook.

## Storybook as a Hub

Once every codebase has a Storybook, the individual tools stop competing. The slides'
framing: a frontend workshop is a one-stop shop for *"what can this do, why, and let me play
with it"* — component states, generated docs, runnable tests, and the domain model (via
markdown docs from TypeDoc) all living in the same sidebar.
