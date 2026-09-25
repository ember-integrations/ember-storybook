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

## `@model` and `@controller` Are the Only Inputs

A route template receives only `@model` and `@controller`, because that is all
<code v-pre>{{outlet}}</code> passes down. Ordinary args do not reach it, so a route story drives
its template through those two args, and Controls work on the model object:

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

## Labelling the Stub

The toolbar's `Placeholder` renders an unlabelled marker. When a story needs to say
_which_ child route would render there, give `route.outlet` a template — an
explicit stub is author intent and **wins over the toolbar in both directions**:

```glimmer-ts [route.stories.gts]
import { OutletPlaceholder } from 'ember-storybook';

import type { StoryObj } from 'ember-storybook';

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

The stub is a _route template_ too, so it also receives only `@model` /
`@controller`, and its own <code v-pre>{{outlet}}</code> is a hole: one level only. Ember has no
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

Precedence for <code v-pre>{{outlet}}</code>:

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
