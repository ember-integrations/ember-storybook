# Route Stories

A **route template** is a template rendered by Ember's router rather than by a
component invocation — anything that contains `{{outlet}}` to
host its child route.

`{{outlet}}` cannot be rendered like a normal component. It is a built-in keyword
helper that reads its child route from Glimmer's *dynamic scope*, and only a root
render seeds that scope. Rendering a route template with `renderComponent` — what
a normal story does — therefore fails instead of showing the template:

```
Cannot destructure property 'tag' of 'undefined'
```

Setting `parameters.ember.route` tells the renderer to mount the story through
Ember's own outlet root (the same view `Router` uses), so `{{outlet}}` resolves
normally.

## A route template

```glimmer-ts
// app/templates/outer.gts
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

## The story

```glimmer-ts
// app/templates/outer.stories.gts
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

There is no router and no URL behind a route story, so what `{{outlet}}` renders is
a choice — see the next section. By default it is a **hole**: nothing at all,
exactly what the template shows in the app when the route has no active child.

> [!TIP] Colocate outside the router's own directories
>
> This story sits next to its template. That is fine, but note the demo's
> `app.ts` registers templates with an *eager* glob
> (`import.meta.glob('./templates/**/*')`), so it excludes `*.stories.*` —
> otherwise a story file would be registered as a bogus route template and pull
> Storybook's code into the app bundle.

## The Ember toolbar menu

The framework contributes an **Ember** menu to the Storybook toolbar that decides
how every route story renders `{{outlet}}`:

| Menu item    | `{{outlet}}` renders                                        |
| ------------ | ----------------------------------------------------------- |
| `Hole`       | nothing (the default)                                        |
| `Placeholder` | the framework's `OutletPlaceholder` marker component        |

It is a plain Storybook global (key `outlet`), so it is shared across stories,
survives reloads through the URL (`&globals=outlet:placeholder`), and can be
declared as a story or meta `globals` to pin it:

```glimmer-ts
// Deterministic regardless of how the toolbar is set.
export const EmptyOutlet: StoryObj = {
  globals: {
    outlet: 'hole'
  }
};
```

Story-level `globals` win over the toolbar (that is how Storybook resolves
globals), which is what makes the assertions above reliable.

It ships from the framework's own preview annotation, so projects get the menu
without configuration. To change the starting value, a project can declare its
own:

```typescript
// .storybook/preview.ts
export default {
  initialGlobals: { outlet: 'placeholder' }
} satisfies Preview;
```

Toggling the menu on a **non-route** story does not remount it — the renderer
ignores that global unless the story opted into `ember.route`, so a component's
tracked state survives.

## `@model` and `@controller` are the only inputs

A route template receives only `@model` and `@controller`, because that is all
`{{outlet}}` passes down. Ordinary args do not reach it, so a route story drives
its template through those two args, and Controls work on the model object:

```glimmer-ts
export const WithModel: StoryObj = {
  args: {
    model: { title: 'Anything the model hook would return' }
  }
};
```

`parameters.ember.route.model` / `.controller` override the args if a story needs a
fixed value.

## Labelling the stub

The toolbar's `Placeholder` renders an unlabelled marker. When a story needs to say
*which* child route would render there, give `route.outlet` a template — an
explicit stub is author intent and **wins over the toolbar in both directions**:

```glimmer-ts
import { OutletPlaceholder } from 'ember-storybook';

export const MarkedOutlet: StoryObj = {
  parameters: {
    ember: {
      route: {
        outlet: {
          name: 'nested',
          template: OutletPlaceholder,
          model: 'nested'
        }
      }
    }
  }
};
```

The stub is a *route template* too, so it also receives only `@model` /
`@controller`, and its own `{{outlet}}` is a hole: one level only. Ember has no
named outlets, so there is nothing else to stub.

## Reference

```typescript
parameters: {
  ember: {
    route?: {
      name?: string;        // debug/render-tree name, defaults to the story name
      model?: unknown;      // @model, defaults to args.model
      controller?: unknown; // @controller, defaults to args.controller
      outlet?: {            // explicit stub; wins over the toolbar `outlet` global
        name?: string;
        template?: object;
        model?: unknown;
        controller?: unknown;
      };
    };
  };
}

// The toolbar global the framework contributes (key + values):
globals: {
  outlet?: 'hole' | 'placeholder';
}
```

Precedence for `{{outlet}}`:

1. `parameters.ember.route.outlet.template` — explicit stub, always wins.
2. `outlet` global (`'placeholder'` → marker, `'hole'`/unset → nothing).

> [!NOTE] Limitations
>
> - Route stories render in the canvas only. `<RenderStory>` (portable stories)
>   throws for them, because a second outlet root cannot be nested inside a render
>   that is already running.
> - Route stories cannot share a booted app with a component story; switching modes
>   remounts the application.
> - Real routing behavior — model hooks, transitions, `LinkTo` active states — is
>   not simulated. Use the demo app's own routes for that.
