import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  sourcemap: true,
  clean: true,
  dts: true,
  deps: {
    neverBundle: [
      /^typedoc/,
      /^typedoc-plugin-ember/,
      /^content-tag/,
      /^oxc-parser/,
      /^tinyglobby/,
      /^typescript/,
    ],
  },
});
