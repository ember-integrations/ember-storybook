import { createApp } from '#app/app.ts';
import { configure } from '#app/config.ts';

import type Owner from '@ember/owner';
import type { Preview } from 'ember-storybook';

const preview: Preview = {
  globalTypes: {
    locale: {
      description: 'Internationalization locale',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'en', right: '🇺🇸', title: 'English' },
          { value: 'de', right: '🇩🇪', title: 'German' }
        ]
      }
    }
  },
  initialGlobals: {
    locale: 'en'
  },
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
      app: (options: Record<string, unknown> = {}) => createApp(options),
      configure,
      updateGlobals: (globals: Record<string, unknown>, owner: Owner) => {
        if (globals.locale) {
          owner.lookup('service:intl').setLocale(globals.locale as string);
        }
      }
    }
  },

  tags: ['vitest', 'autodocs']
};

export default preview;
