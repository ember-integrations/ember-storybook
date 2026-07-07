import type { Preview } from 'ember-storybook';
import { createApp } from '#app/app.ts';
import { configure } from '#app/config.ts';

const preview: Preview = {
  parameters: {
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

  tags: ['vitest', 'autodocs']
};

export default preview;
