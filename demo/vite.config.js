import { loadTranslations } from '@ember-intl/vite';
import { ember, extensions } from '@embroider/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { babel } from '@rollup/plugin-babel';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    ember(),
    babel({
      babelHelpers: 'runtime',
      extensions
    }),
    loadTranslations()
  ],
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          storybookTest({
            // The location of your Storybook config, main.js|ts
            configDir: path.join(dirname, '.storybook'),
            // This should match your package.json script to run Storybook
            // The --no-open flag will skip the automatic opening of a browser
            storybookScript: 'pnpm storybook --no-open'
          })
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [{ browser: 'chromium' }]
          }
        }
      }
    ]
  }
});
