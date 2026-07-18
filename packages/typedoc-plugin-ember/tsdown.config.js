import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  sourcemap: true,
  clean: true,
  dts: true,
  deps: {
    neverBundle: [/^typedoc/, /^typescript/, /^content-tag/],
  },
});
