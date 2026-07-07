import { defineConfig } from "vite";
import { ember, extensions } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';
import { loadTranslations } from '@ember-intl/vite';

export default defineConfig({
  plugins: [
    ember(),
    babel({
      babelHelpers: 'runtime',
      extensions
    }),
    loadTranslations()
  ],
});
