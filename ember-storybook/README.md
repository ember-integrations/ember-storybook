# Storybook for Ember

Storybook for Ember is a UI development environment for your Ember components.
With it, you can visualize different states of your UI components and develop them interactively.

![Storybook Screenshot](https://github.com/storybookjs/storybook/blob/main/media/storybook-intro.gif)

Storybook runs outside of your app.
So you can develop UI components in isolation without worrying about app specific dependencies and requirements.

## Getting Started

For more information visit: [storybook.js.org](https://storybook.js.org?ref=readme)

---

Storybook also comes with a lot of [addons](https://storybook.js.org/addons?ref=readme) and a great API to customize as you wish.
You can also build a [static version](https://storybook.js.org/docs/sharing/publish-storybook?renderer=ember&ref=readme) of your Storybook and deploy it anywhere you want.

## Docs

- [Basics](https://storybook.js.org/docs/get-started/install?renderer=ember&ref=readme)
- [Configurations](https://storybook.js.org/docs/configure?renderer=ember&ref=readme)
- [Addons](https://storybook.js.org/docs/configure/user-interface/storybook-addons?renderer=ember&ref=readme)

## CSF Next

This framework supports the [CSF Next factory syntax](https://storybook.js.org/docs/api/csf/csf-next)
alongside classic CSF. Wire up `defineMain` and `definePreview`, then build
stories from `preview.meta()` — story `args` are inferred from the component's
Ember signature:

```ts
// .storybook/main.ts
import { defineMain } from 'ember-storybook/node';

export default defineMain({
  stories: ['../**/*.stories.g(j|t)s'],
  addons: ['@storybook/addon-docs']
});
```

```ts
// .storybook/preview.ts
import { definePreview } from 'ember-storybook';
import addonDocs from '@storybook/addon-docs';

export default definePreview({
  addons: [addonDocs()],
  parameters: {
    ember: { app: createApp }
  }
});
```

```gts
// button.stories.gts
import preview from '../.storybook/preview';
import { Button } from './button.gts';

const meta = preview.meta({ component: Button });

export const Primary = meta.story({ args: { label: 'Click me' } });
export const Small = Primary.extend({ args: { size: 'small' } });
```

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).
