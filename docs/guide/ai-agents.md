# AI Agents (MCP)

Storybook's [MCP addon](https://storybook.js.org/docs/ai/mcp/overview) lets coding agents —
Claude Code, GitHub Copilot, Cursor and others — read your components' documentation and
stories. Its docs tools read Storybook's
[components manifest](https://storybook.js.org/docs/ai/manifests), which ember-storybook
generates for Ember components.

## Enable It

::: code-group

```sh [pnpm]
pnpm add -D @storybook/addon-mcp
```

```sh [npm]
npm install -D @storybook/addon-mcp
```

```sh [yarn]
yarn add -D @storybook/addon-mcp
```

```sh [bun]
bun add -d @storybook/addon-mcp
```

:::

```ts [.storybook/main.ts]
import type { StorybookConfig } from 'ember-storybook';

const config: StorybookConfig = {
  framework: 'ember-storybook',
  stories: ['../app/**/*.stories.@(gjs|gts)'],
  addons: ['@storybook/addon-mcp'],
};

export default config;
```

`storybook dev` now serves an MCP endpoint at `http://localhost:6006/mcp`. Point your agent at
it, for example in Claude Code:

```sh
claude mcp add --transport http storybook http://localhost:6006/mcp
```

The manifest itself is at `/manifests/components.json`, and `/manifests/components.html`
shows it in a browser.

## What Agents Get

For each component that has stories:

- **Its name and import line.** The import assumes a v2 addon, whose `src/` maps to its
  package exports: `src/components/button.gts` becomes
  `import Button from 'my-addon/components/button';`.
- **Its signature, as Markdown:** every argument with its type, default and description, every
  block with the parameters it yields, and the element `...attributes` is applied to.
- **Its stories,** with each story's template as a code snippet.

Everything comes from your signatures and stories, so JSDoc on arguments and blocks is what
agents read. Labelled block parameters (`default: [item: Item]`) give agents real names
instead of `param0`.

## Static Builds

`storybook build` writes the manifest to `storybook-static/manifests/`. Deploy it with the rest
of your Storybook, and another Storybook running the MCP addon can include your components
through [refs](./sharing#side-by-side-refs).

::: info
Storybook's AI features are in preview, and the manifest format may change.
:::
