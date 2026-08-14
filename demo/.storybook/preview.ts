import { DocsRenderer } from 'ember-storybook/client/docs/renderer';

import { createApp } from '#app/app.ts';
import { configure } from '#app/config.ts';

import { IntlDecorator } from './intl-decorator.gts';

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
      codePanel: true,
      // TEMP experiment: use a stable-key docs renderer so the docs page does
      // not remount (and tear down the story renders) on globals changes
      renderer: () => Promise.resolve(new DocsRenderer())
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
  // decorators: [IntlDecorator],

  tags: ['vitest', 'autodocs']
};

export default preview;
