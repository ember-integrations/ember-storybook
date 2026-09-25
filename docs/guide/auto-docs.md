# Auto-Docs

Auto-docs is Storybook's way to present all your stories for one component on one page, including a the controls panel.

## Set up

::: code-group

```sh [pnpm]
pnpm exec storybook add @storybook/addon-docs
```

```sh [npm]
npx storybook add @storybook/addon-docs
```

```sh [yarn]
yarn storybook add @storybook/addon-docs
```

```sh [bun]
bun x storybook add @storybook/addon-docs
```

:::

The `storybook add` command handles registration for you. If you prefer doing it by hand,
it's one line in `main.ts` — for CSF Next projects also registered in the preview:

:::csf .storybook/main.ts

== CSF v3

```ts
import type { StorybookConfig } from 'ember-storybook';

export default {
  addons: ['@storybook/addon-docs'],
} satisfies StorybookConfig;
```

== CSF-next 🧪

```ts
import { defineMain } from 'ember-storybook/node';

export default defineMain({
  addons: ['@storybook/addon-docs'],
});
```

:::

:::csf .storybook/preview.ts

== CSF v3

```ts
import type { Preview } from 'ember-storybook';

export default {
  tags: ['autodocs'],
} satisfies Preview;
```

== CSF-next 🧪

```ts
import addonDocs from '@storybook/addon-docs';
import { definePreview } from 'ember-storybook';

export default definePreview({
  addons: [addonDocs()],
  tags: ['autodocs'],
});
```

:::

The `autodocs` tag generates a docs page for every component. Drop it to a per-file level if
you want pages selectively.

## Auto-Docs Layout

- **Title, subtitle, description** — your `meta`, plus JSDoc on the component.
- **Primary story** — rendered inline (the framework sets `docs.story.inline` for you).
- **Element** — the HTML tag your component renders, with attributes.
- **Component Signature** - Your component signature (see below)
- **All stories** — with the code that produced them.

## Component Signature

Component signatures are turned into auto documentation and render these parts (if available):

- `Element` - the HTML tag your component renders, with attributes
- `Args` - the Controls table.
- `Blocks` - your named blocks (eg. `<:header>`, `<:default>`), their block params and links to subcomponents they yield
- `CSS Custom Properties` - to list how you can customize the styling
- `Part` - to add custom styles to subelements
- `Subcomponents` - components yielded by block params (same structure as the main component)

## The Source Panel

The code shown under each example isn't stringified args — a source decorator reconstructs
the actual component invocation from your render (or from the implicit invocation, with args
as `@named` arguments), so what you read is what runs. To keep the panel open for all
stories:

```ts [.storybook/preview.ts]
parameters: {
  docs: {
    codePanel: true,
  },
}
```

## Writing Docs

A `*.stories.gts` file is the docs page: `meta` fields for structure, markdown in the file
for prose. For full custom pages use the `.mdx` format — the stories file exports, the MDX
file imports and arranges them:

```mdx [card.stories.mdx ~vscode-icons:file-type-mdx~]
# Card

import { Primary } from './card.stories.gts';
import { Canvas } from '@storybook/addon-docs/blocks';

A surface for grouped content.

<Canvas of={Primary} />
```

Storybook's [docs writing guide](https://storybook.js.org/docs/writing-docs) covers MDX,
`Parameters.docs`, and custom blocks; all of it applies here.
