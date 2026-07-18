import { fileURLToPath } from 'node:url';

import { type StorybookConfigVite, withoutVitePlugins } from '@storybook/builder-vite';

import { emberIndexer } from './node/indexer';
import { emberStorybookPlugin } from './node/vite-plugin';

import type { StorybookConfig } from './types';
import type { PresetProperty } from 'storybook/internal/types';
import type { UserConfig } from 'vite';

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  // eslint-disable-next-line @typescript-eslint/default-param-last
  entries = [],
  options
) => {
  const config = fileURLToPath(import.meta.resolve('ember-storybook/client/config'));
  const annotations = [...entries, config];

  const docsConfig = await options.presets.apply('docs', {}, options);
  const docsEnabled = Object.keys(docsConfig).length > 0;

  if (docsEnabled) {
    const docsConfigPath = fileURLToPath(import.meta.resolve('ember-storybook/client/docs/config'));

    annotations.push(docsConfigPath);
  }

  return annotations;
};

export const viteFinal: StorybookConfigVite['viteFinal'] = async (config: UserConfig) => {
  const { mergeConfig } = await import('vite');

  config.plugins = await withoutVitePlugins(config.plugins, ['embroider-content-for']);

  return mergeConfig(config, {
    plugins: [...emberStorybookPlugin()],
    optimizeDeps: {
      exclude: ['object-inspect']
    },
    resolve: {
      dedupe: ['ember-source']
    }
  });
};

export const experimental_indexers: StorybookConfig['experimental_indexers'] = (indexers) => {
  return [emberIndexer, ...(indexers ?? [])];
};

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: import.meta.resolve('@storybook/builder-vite'),
      options:
        typeof framework === 'string'
          ? {}
          : // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            ((framework.options?.builder ?? {}) as object)
    }
  };
};
