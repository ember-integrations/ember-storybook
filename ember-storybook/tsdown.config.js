import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/preset.ts', 'src/client/index.ts', 'src/client/config.ts', 'src/client/docs/config.ts', 'src/node/index.ts'],
  sourcemap: true,
  clean: true,
  dts: true,
  deps: {
    neverBundle: [/^@ember/]
  }
});
