# App Context & Globals

A story in Ember creates an `Application` so services work, resolvers work, `owner` works.
This page is about shaping that environment per project, per component, or per story.

Everything lives under `parameters.ember`, which — like any Storybook parameter — can be
declared globally in `preview.ts`, on a story's meta, or on a single story, and the lower
level wins.

## app

The application to boot. Accepts an `Application`, an `ApplicationInstance`, or a factory
function returning either:

```ts [.storybook/preview.ts]
import { createApp } from '#app/app';

import type { Preview } from 'ember-storybook';

const preview: Preview = {
  parameters: {
    ember: {
      app: (options) => createApp(options),
    },
  },
};
```

The app boots once per canvas and is reused across re-renders of the same story, so tracked
state survives arg changes. Switching between a component story and a
[route story](/guide/route-stories) remounts, because they need different roots.

## `configure`

In most Ember Apps, the configuration sits in the `ApplicationRoute`'s `beforeModel` hook.
A normal Ember App boots _and navigates_ to the Application route.
This navigation never happens in Storybook, your configuration never runs and you might end up with an unconfigured app.
To help you out, there is a `configure` option, that takes a function and is passed the `ApplicationInstance` (which gives you access to the owner) in which you can configure your app.

```ts [app/config.ts]
import type ApplicationInstance from '@ember/application/instance';

export function configure(app: ApplicationInstance) {
  const intl = app.lookup('service:intl');

  intl.addTranslations('en', translationsEn);
  intl.setLocale('en');
}
```

```ts [.storybook/preview.ts]
import { createApp } from '#app/app';
import { configure } from '#app/config';

import type { Preview } from 'ember-storybook';

export default {
  parameters: {
    ember: {
      app: createApp,
      configure,
    },
  },
} satisfies Preview;
```

Share the same `configure` with your app's real entry (`app.ts` or `index.html`) so there is
one definition of "how this app is set up". `configure` runs _before_ the instance boots —
register and lookup are still available.

## `owner`

Use the `owner` parameter to stub the owner for dependency injection (as you would do in tests).
Keys are Ember's `type:name` strings, values are registered in place of your actual objects.

```ts [example.stories.ts]
import type { StoryObj } from 'ember-storybook';

export const LoggedIn: StoryObj = {
  parameters: {
    ember: {
      owner: {
        'service:session': StorySessionService,
      },
    },
  },
};
```

## `updateGlobals` & the Toolbar

Storybook's toolbar globals (locale, theme, session…) are plain values, but your Ember
services need to be _told_ about them. Use `updateGlobals(globals, owner)` for
that, which is wired to `globalTypes`:

```ts [.storybook/preview.ts]
import { createApp } from '#app/app';

import type { Preview } from 'ember-storybook';

const preview: Preview = {
  globalTypes: {
    locale: {
      description: 'Internationalization locale (ember-intl)',
      defaultValue: 'en',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'de', title: 'Deutsch' },
        ],
        dynamicTitle: true,
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
};
```

`updateGlobals` runs after boot and again whenever a global changes — on the _live_ app
instance, so switching the locale in the toolbar re-renders the story in place without
losing state.

The framework contributes one global of its own: `outlet`, the "Ember" toolbar menu for
[route stories](/guide/route-stories).

## The Full Parameter Shape

```ts [ember-storybook/src/client/types.ts]
parameters: {
  ember: {
    app?: Application | ApplicationInstance | ((options?: object) => Application | ApplicationInstance);
    configure?: (app: ApplicationInstance) => void;
    owner?: Record<`${string}:${string}`, object>;
    updateGlobals?: (globals: Record<string, unknown>, owner: Owner) => void;
    route?: RouteParameters; // see Route Stories
  }
}
```

Detailed reference: [Ember Parameters](/configuration/ember-parameters).
