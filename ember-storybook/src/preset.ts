import { fileURLToPath } from 'node:url';

import { type StorybookConfigVite, withoutVitePlugins } from '@storybook/builder-vite';

import { emberIndexer } from './node/indexer';
import { emberStorybookPlugin } from './node/vite-plugin';

import type { StorybookConfig } from './types';
import type { PresetProperty } from 'storybook/internal/types';
import type { Plugin, UserConfig } from 'vite';

// The generated preview imports the addon-docs preview by its absolute path.
// Redirect that import to our patched module so `docs.renderer` is overridden
// with the stable-key DocsRenderer (the framework's own `docs.renderer` never
// wins the annotation merge, and mutating the module in place is unreliable due
// to Vite dep pre-bundling splitting module instances).
function docsRendererPlugin(docsPreviewPatch: string): Plugin {
  return {
    name: 'ember-storybook:docs-renderer',
    enforce: 'pre',
    resolveId(source) {
      if (source.includes('@storybook/addon-docs') && source.endsWith('preview.js')) {
        return docsPreviewPatch;
      }
    }
  };
}

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

// `managerEntries` is a preset extension, not a `StorybookConfigRaw` key, so
// `PresetProperty<'managerEntries'>` resolves to `never` — type it directly.
export const managerEntries = (entries: string[] = []): string[] => [
  ...entries,
  fileURLToPath(import.meta.resolve('ember-storybook/manager'))
];

export const viteFinal: StorybookConfigVite['viteFinal'] = async (config: UserConfig) => {
  const { mergeConfig } = await import('vite');

  config.plugins = await withoutVitePlugins(config.plugins, ['embroider-content-for']);

  const docsPreviewPatch = fileURLToPath(
    import.meta.resolve('ember-storybook/client/docs/preview-patch')
  );

  return mergeConfig(config, {
    plugins: [...emberStorybookPlugin(), docsRendererPlugin(docsPreviewPatch)],
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
