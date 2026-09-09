import { defineConfig } from 'eslint/config';
import { configs as storybook } from 'eslint-plugin-storybook';

import ember from '@gossi/config-eslint/ember';

export default defineConfig([
  {
    ignores: ['storybook-static/']
  },
  ...ember(import.meta.dirname),
  ...storybook['flat/recommended'],
  ...storybook['flat/csf']
]);
