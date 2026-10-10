# Route Stories

You can write stories for **route templates**, too.
The special part is the <code v-pre>{{outlet}}</code> keyword.
`ember-storybook` handles the keyword and provides you options for customizing the look and feel of <code v-pre>{{outlet}}</code>.

## A Route Template

```glimmer-ts [app/templates/outer.gts]
import type { TOC } from '@ember/component/template-only';

interface OuterSignature {
  Element: HTMLDivElement;
  Args: {
    model?: { title: string };
  };
}

const Outer: TOC<OuterSignature> = <template>
  <div class="outer-route">
    <h2>Outer route</h2>
    <p>{{@model.title}}</p>

    {{outlet}}
  </div>
</template>;

export default Outer;
```

## The Story

```glimmer-ts [app/templates/outer.stories.gts]
import Outer from '#app/templates/outer.gts';

import type { Meta, StoryObj } from 'ember-storybook';

export default {
  title: 'Routes/Outer',
  component: Outer,
  args: {
    model: { title: 'Outer route reached from a story' }
  },
  parameters: {
    ember: {
      route: {}
    }
  }
} satisfies Meta;

export const Default: StoryObj = {};
```

> [!TIP] Colocate outside the router's own directories
>
> This story sits next to its template. That is fine, but note the demo's
> `app.ts` registers templates with an _eager_ glob
> (`import.meta.glob('./templates/**/*')`), so it excludes `*.stories.*` —
> otherwise a story file would be registered as a bogus route template and pull
> Storybook's code into the app bundle.

## The Ember Toolbar Menu

`ember-storybook` contributes an **Ember** menu to the Storybook toolbar that decides
how every route story renders <code v-pre>{{outlet}}</code>:

| Menu item     | <code v-pre>{{outlet}}</code> renders                                  |
| ------------- | ---------------------------------------------------------------------- |
| `Hole`        | nothing (the default)                                                  |
| `Placeholder` | the `OutletPlaceholder` marker component provided by `ember-storybook` |

It is a plain Storybook global (key `outlet`), so it is shared across stories,
survives reloads through the URL (`&globals=outlet:placeholder`), and can be
declared as a story or meta `globals` to pin it:

```glimmer-ts [route.stories.gts]
import type { StoryObj } from 'ember-storybook';

export const EmptyOutlet: StoryObj = {
  globals: {
    outlet: 'hole'
  }
};
```

The default value is `hole`. To change it globally, use the `initialGlobals` preview configuration by storybook.

```typescript [.storybook/preview.ts]
import type { Preview } from 'ember-storybook';

export default {
  initialGlobals: { outlet: 'placeholder' },
} satisfies Preview;
```

## `@model` and `@controller` Are the Inputs

A route template receives `@model` and `@controller` — exactly what Ember's
outlet hands a child route (`@outlet` as well on Ember ≥ 7.5, see
[How the outlet renders](#how-the-outlet-renders)). Ordinary args do not reach
it, so a route story drives its template through those two args, and Controls
work on the model object:

```glimmer-ts [route.stories.gts]
import type { StoryObj } from 'ember-storybook';

export const WithModel: StoryObj = {
  args: {
    model: { title: 'Anything the model hook would return' }
  }
};
```

`parameters.ember.route.model` / `.controller` override the args if a story needs a
fixed value.

## How the outlet renders

What <code v-pre>{{outlet}}</code> shows is either the toolbar's choice or the story's:

| `route.outlet`          | <code v-pre>{{outlet}}</code> renders                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| omitted                 | the **Ember** menu: `hole` (default) or `placeholder` (the marker)         |
| a string (`'settings'`) | the `OutletPlaceholder` marker, labeled with the string                    |
| a component             | that component — an imported one, or an inline `<template>`                |

An explicit `route.outlet` is author intent and **wins over the toolbar in both
directions** — a story pinned this way renders identically no matter what a
visitor has selected in the menu:

```glimmer-ts [route.stories.gts]
import { OutletPlaceholder } from 'ember-storybook';

import type { StoryObj } from 'ember-storybook';

export const MarkedOutlet: StoryObj = {
  parameters: {
    ember: {
      route: {
        outlet: 'nested' // labeled marker; `outlet: OutletPlaceholder` renders it bare
      }
    }
  }
};
```

The stub is one level only: a <code v-pre>{{outlet}}</code> *inside* the stub renders a
hole, just like a child route with no child of its own. Ember has no named
outlets, so there is nothing else to stub.

> [!NOTE] How this works under the hood
>
> Ember changed the machinery behind `{{outlet}}` with its RFC 1099 route
> rendering: until 7.4 <code v-pre>{{outlet}}</code> is a keyword that reads its child
> route from Glimmer's dynamic scope, and `ember-storybook` seeds that scope
> through Ember's own outlet root (the view `Router._setOutlets()` uses). Since
> 7.5.0-alpha.2 `{{outlet}}` compiles to `<@outlet />` — the route template's
> own argument, holding a component — and the addon renders route stories as
> plain components, passing `@outlet` exactly like Ember's router does. The
> backend is picked by probing the running build; stories work the same on both.

## Reference

```typescript
parameters: {
  ember: {
    route?: {
      name?: string;        // debug/render-tree name, defaults to the story name
      model?: unknown;      // @model, defaults to args.model
      controller?: unknown; // @controller, defaults to args.controller
      outlet?: string | ComponentLike; // explicit stub; wins over the toolbar `outlet` global
    };
  };
}

// The toolbar global the framework contributes (key + values):
globals: {
  outlet?: 'hole' | 'placeholder';
}
```

Precedence for <code v-pre>{{outlet}}</code>:

1. `parameters.ember.route.outlet` — explicit stub (string label or component), always wins.
2. `outlet` global (`'placeholder'` → marker, `'hole'`/unset → nothing).

> [!NOTE] Limitations
>
> - Route stories render in the canvas only. `<RenderStory>` (portable stories)
>   throws for them, because that path has no outlet mode or route parameters.
> - On Ember builds with the classic outlet root, route stories cannot share a
>   booted app with a component story; switching modes remounts the application.
> - Real routing behavior — model hooks, transitions, `LinkTo` active states — is
>   not simulated. Use the demo app's own routes for that.
