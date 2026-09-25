# Ember Parameters

Everything the framework understands under `parameters.ember`. The values below are the
source of truth from `ember-storybook`'s type definitions.

```ts
interface EmberParameters {
  ember?: {
    app?: AppParameter;
    configure?: (app: ApplicationInstance) => void;
    owner?: Record<`${string}:${string}`, object>;
    updateGlobals?: (globals: Record<string, unknown>, owner: Owner) => void;
    route?: RouteParameters;
  };
}
```

Like any Storybook parameter, each can be declared in `preview.ts` (every story), on a
`meta` (one component), or on a single story — the innermost declaration wins. Only the
keys you set are merged; you don't have to repeat the others.

## `app`

**Type:** `Application | ApplicationInstance | ((options?: object) => Application | ApplicationInstance)`
**Required.**

What to boot for rendering. The factory form is the practical one:

```ts [.storybook/preview.ts]
app: (options = {}) => createApp(options);
```

The renderer passes initialization options (among them the canvas `rootElement`) to the
factory, boots the instance once per canvas, and reuses it while the story stays mounted.
Without `app`, the framework deliberately fails the story with a message instead of booting
a resolver-less application that would die obscurely later.

## `configure`

**Type:** `(app: ApplicationInstance) => void`

Runs after the app instance is created, _before_ it boots. Storybook doesn't run your
`ApplicationRoute`, so startup work that isn't module registration — registering
translations, seeding a store, configuring a service — goes here. Share the function with
your app's entry point so there's one definition of app setup.

```ts [.storybook/preview.ts]
import { createApp } from '#app/app';
import { configure } from '#app/config';

import type { Preview } from 'ember-storybook';

export default {
  parameters: { ember: { app: createApp, configure } },
} satisfies Preview;
```

## `owner`

**Type:** `Record<`${string}:${string}`, object>`

DI overrides keyed by Ember's `type:name` strings (`'service:session'`,
`'route-map:router'`, `'modifier:scroll'`, …). Each entry replaces the app's registration on
that story's instance:

```ts [example.stories.ts]
import type { StoryObj } from 'ember-storybook';

export const LoggedOut: StoryObj = {
  parameters: {
    ember: {
      owner: { 'service:session': StubSessionService },
    },
  },
};
```

Use it when stubbing a collaborator is easier than shaping its real state through args.

## `updateGlobals`

**Type:** `(globals: Record<string, unknown>, owner: Owner) => void`

The bridge between Storybook's toolbar and your services. Called once after boot and again
on every globals change — against the _live_ application instance, so no remount happens and
component state survives.

```ts [.storybook/preview.ts]
import { createApp } from '#app/app';

import type { Preview } from 'ember-storybook';

export default {
  globalTypes: {
    locale: {
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'de', title: 'Deutsch' },
        ],
      },
    },
  },
  parameters: {
    ember: {
      app: createApp,
      updateGlobals(globals, owner) {
        owner.lookup('service:intl').setLocale(globals.locale as string);
      },
    },
  },
} satisfies Preview;
```

## `route`

Presence of this key marks the story a [route story](/guide/route-stories): the template
mounts through Ember's outlet root, so <code v-pre>{{outlet}}</code> resolves. A template that uses
<code v-pre>{{outlet}}</code> renders that way even with an empty `route: {}`.

```ts
route?: {
  name?: string;         // debug/render-tree name; defaults to the story name
  model?: unknown;       // @model; defaults to args.model
  controller?: unknown;  // @controller; defaults to args.controller
  outlet?: {             // explicit {{outlet}} stub
    name?: string;
    template?: object;
    model?: unknown;
    controller?: unknown;
  };
};
```

Route templates receive only `@model` and `@controller` — that's all <code v-pre>{{outlet}}</code> passes —
and an explicit `outlet` stub wins over the toolbar global in both directions. The full
model (including limitations) lives on the [Route Stories](/guide/route-stories) page.

## The `outlet` Global

The framework contributes one global (toolbar menu "Ember"), deciding how every route story
renders <code v-pre>{{outlet}}</code>:

| Value         | <code v-pre>{{outlet}}</code> renders    |
| ------------- | ---------------------------------------- |
| `hole`        | nothing (default)                        |
| `placeholder` | the `OutletPlaceholder` marker component |

It's a normal global: set it from the toolbar (persisted in the URL as
`&globals=outlet:placeholder`), as an initial value, or pinned per story:

```ts [.storybook/preview.ts]
import type { Preview } from 'ember-storybook';

export default {
  initialGlobals: { outlet: 'placeholder' },
} satisfies Preview;
```

```gts [route.stories.gts]
import type { StoryObj } from 'ember-storybook';

export const EmptyOutlet: StoryObj = {
  globals: { outlet: 'hole' }
};
```

Toggling it on a non-route story doesn't remount that story — the renderer ignores the
global unless the story opted into `ember.route`.
