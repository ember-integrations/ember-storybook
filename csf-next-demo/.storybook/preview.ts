import addonDocs from '@storybook/addon-docs';
import addonVitest from '@storybook/addon-vitest';
import { definePreview } from 'ember-storybook';

import { createApp } from '#app/app.ts';

export default definePreview({
  addons: [addonDocs(), addonVitest()],
  parameters: {
    docs: {
      codePanel: true
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    ember: {
      app: (options: Record<string, unknown> = {}) => createApp(options)
    }
  },

  tags: ['vitest', 'autodocs']
});
