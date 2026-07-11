import { createApp } from '#app/app.ts';
import { configure } from '#app/config.ts';

import type { Preview } from 'ember-storybook';
import { IntlDecorator } from './intl-decorator.gts';

const preview: Preview = {
  globalTypes: {
    locale: {
      description: 'Internationalization locale',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'en', right: '🇺🇸', title: 'English' },
          { value: 'de', right: '🇩🇪', title: 'German' },
        ],
      }
    }
  },
  initialGlobals: {
    locale: 'en'
  },
  parameters: {
    docs: {
      codePanel: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    ember: {
      app: (options: Record<string, unknown> = {}) => {
        const app = createApp(options);

        configure(app);

        return app;
      }
    }
  },
  decorators: [IntlDecorator],

  tags: ['vitest', 'autodocs']
};

export default preview;
