# Writing Stories

A story captures a rendered state of a component: the component plus the arguments that produce
that state. Everything else in Storybook — docs, tests, design reviews — is built on top of
stories.

::: tip
This page covers what's specific to Ember. For the general shape of CSF — `meta`, named
exports, args, fixtures — Storybook's own
[Writing Stories](https://storybook.js.org/docs/writing-stories) is the reference.
:::

## Two Dialects

The framework supports both ways of writing stories. Pick one per project; they share the
same renderer and parameters.

:::csf card.stories.gts

== CSF v3

The familiar `Meta` / `StoryObj` form. The default export describes the component, each
named export is a story.

```gts
import Card from './card.gts';

import type { Meta, StoryObj } from 'ember-storybook';

export default {
  title: 'Surfaces/Card',
  component: Card
} satisfies Meta;

export const Default: StoryObj = {};

export const WithTitle: StoryObj = {
  args: {
    title: 'Emberfest'
  }
};
```

== CSF-next 🧪

Factory syntax with fully typed stories: you build stories from the preview, so `args` are
inferred from the component's Ember signature and typos become compile errors.

```gts
import preview from '#storybook/preview';
import Card from './card.gts';

const meta = preview.meta({
  title: 'Surfaces/Card',
  component: Card
});

export const Default = meta.story({});

export const WithTitle = meta.story({
  args: {
    title: 'Emberfest'
  }
});
```

:::

The component's signature is the single source of truth: an `Args` interface like

```gts [card.gts]
export interface CardSignature {
  Element: HTMLDivElement;
  Args: {
    /** Heading shown above the card */
    title?: string;
    intent?: 'action' | 'cancel' | 'danger';
    disabled?: boolean;
  };
  Blocks: {
    default: [];
  };
}
```

gives you Controls for `title`, `intent`, and `disabled` — with types, defaults, and option
lists inferred. Typedoc comments on the args become the Control descriptions.

## Controls and `argTypes`

Controls are inferred from your component signature.
You can enhance these with `argTypes` for customization.
User-defined entries win over the inferred ones and keep the order you wrote them in — in the Controls
panel and in the docs table alike.

:::csf card.stories.gts

== CSF v3

```gts
import Card from './card.gts';

import type { Meta } from 'ember-storybook';

export default {
  title: 'Surfaces/Card',
  component: Card,
  argTypes: {
    intent: {
      control: { type: 'select' },
      options: ['action', 'cancel', 'danger']
    },
    close: { type: 'function' }
  }
} satisfies Meta;
```

== CSF-next 🧪

```gts
import preview from '#storybook/preview';
import Card from './card.gts';

const meta = preview.meta({
  title: 'Surfaces/Card',
  component: Card,
  argTypes: {
    intent: {
      control: { type: 'select' },
      options: ['action', 'cancel', 'danger']
    },
    close: { type: 'function' }
  }
});
```

:::

Callbacks like `close` can't be inferred as controls.
Pass `action()` from `storybook/actions` or `fn()` from `storybook/test` as arg.

## Variants

Stories are meant to be cheap. In classic CSF, each variant repeats its args; in CSF Next,
`.extend()` derives one story from another:

```gts [card.stories.gts]
export const Danger = Basic.extend({
  args: {
    intent: 'danger'
  }
});
```

## Rendering

The default render passes every arg to the component as a named argument (`@title`,
`@disabled`). That covers most components. Reach for an explicit `render` when the component
takes blocks, positional args, or when the story's args don't map 1:1 onto the invocation:

```gts [card.stories.gts]
import Card from './card.gts';

import type { Meta } from 'ember-storybook';

export default {
  title: 'Surfaces/Card',
  component: Card,
  render: (args) => <template>
    <Card @intent={{args.intent}} as |section|>
      <section.header>{{args.title}}</section.header>
    </Card>
  </template>
} satisfies Meta;
```

Decorators can wrap the same way — see [Decorators](/guide/decorators).

## Typing Story Args Explicitly

When you use CSFv3 and want the compiler to check `args` against your component, pass
the args type to `Meta`/`StoryObj`. Since you already have a signature interface in your
component file, reuse it:

```gts [card.stories.gts]
import Card from './card.gts';

import type { Meta, StoryObj } from 'ember-storybook';
import type { CardSignature } from './card.gts';

export default {
  title: 'Surfaces/Card',
  component: Card
} satisfies Meta<CardSignature['Args']>;

export const WithTitle: StoryObj<CardSignature['Args']> = {
  args: { title: 'Emberfest' } // ✓ checked against the signature
};
```

CSF Next does this inference for you via `preview.meta()`.

## What's Next

- Make stories reusable and wrappable: [Decorators](/guide/decorators)
- Show them off with prose and tables: [Auto-Docs](/guide/auto-docs)
- Assert on them: [Testing](/guide/testing)
