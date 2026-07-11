import { Addon } from '@embroider/addon-dev/rollup';
import { extensions } from '@embroider/vite';

import { babel } from '@rollup/plugin-babel';
import { defineConfig } from 'tsdown';

const addon = new Addon({
  srcDir: 'src',
  destDir: 'dist'
});

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/preset.ts',
    'src/client/index.ts',
    'src/client/config.ts',
    'src/client/docs/config.ts',
    'src/node/index.ts'
  ],
  sourcemap: true,
  clean: true,
  dts: false,
  deps: {
    neverBundle: [/^@ember/]
  },
  plugins: [
    babel({
      babelHelpers: 'bundled',
      extensions
    }),
    addon.dependencies(), // misses on `@ember/reactive/collections`
    addon.gjs(),
    addon.declarations('declarations', `ember-tsc --declaration --project ./tsconfig.json`)
  ],
  ignoreWatch: ['declarations/']
});
