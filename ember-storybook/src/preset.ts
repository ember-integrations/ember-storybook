import { fileURLToPath } from 'node:url';

import { type StorybookConfigVite, withoutVitePlugins } from '@storybook/builder-vite';
import { versions } from 'storybook/internal/common';

import { emberIndexer } from './node/indexer';
import { buildComponentsManifest } from './node/manifest';
import { emberStoryDocsProvider } from './node/story-docs';
import { emberStorybookPlugin } from './node/vite-plugin';

import type { StorybookConfig } from './types';
import type {
  ComponentsManifest,
  DocgenProviderDescriptor,
  IndexEntry,
  Manifests,
  Options,
  PresetProperty,
  StoryDocsProvider,
  StoryIndex
} from 'storybook/internal/types';
import type { Plugin, UserConfig } from 'vite';

// The generated preview imports the addon-docs preview by its absolute path.
// Redirect that import to our patched module so `docs.renderer` is overridden
// with the stable-key DocsRenderer (the framework's own `docs.renderer` never
// wins the annotation merge, and mutating the module in place is unreliable due
// to Vite dep pre-bundling splitting module instances).
//
// The second rule covers CSF Next: a csf-next project registers addon-docs in
// its preview file as `import addonDocs from '@storybook/addon-docs'` +
// `addons: [addonDocs()]` (the preset path is bypassed entirely there), so the
// bare root import is redirected to a factory module that wraps the real
// annotations with the same patched renderer plus the Ember autodocs page.
// The factory re-exports the real root (`DocsRenderer`, default), so it must
// resolve `@storybook/addon-docs` for real when *it* is the importer —
// otherwise the redirect would recurse into itself.
function docsRendererPlugin(docsPreviewPatch: string, docsAddonFactory: string): Plugin {
  const factoryFile = docsAddonFactory.split('/').slice(-3).join('/');

  return {
    name: 'ember-storybook:docs-renderer',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.includes('@storybook/addon-docs') && source.endsWith('preview.js')) {
        return docsPreviewPatch;
      }

      // Suffix compare: Vite reports importers as plain fsPaths or `/@fs/…`
      // depending on how the module was loaded.
      const fromFactory = importer?.replace(/^\/@fs/, '').endsWith(factoryFile);

      if (source === '@storybook/addon-docs' && !fromFactory) {
        return docsAddonFactory;
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
  const docsAddonFactory = fileURLToPath(
    import.meta.resolve('ember-storybook/client/docs/addon-preview')
  );

  return mergeConfig(config, {
    plugins: [...emberStorybookPlugin(), docsRendererPlugin(docsPreviewPatch, docsAddonFactory)],
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

/** The docgen server's feature flag, which Storybook 11 renamed. */
async function docgenServerEnabled(options: Options): Promise<boolean> {
  const features = (await options.presets.apply('features')) as Record<string, unknown> | undefined;
  const flag =
    Number(versions.storybook.split('.', 1)[0]) >= 11 ? 'docgenServer' : 'experimentalDocgenServer';

  return features?.[flag] === true;
}

// The docgen server (opt-in) runs these instead of the components manifest.
export const experimental_docgenProvider = (
  existing: DocgenProviderDescriptor[] = []
): DocgenProviderDescriptor[] => [
  ...existing,
  { moduleSpecifier: fileURLToPath(import.meta.resolve('ember-storybook/docgen-worker')) }
];

export const experimental_storyDocsProvider = (next: StoryDocsProvider, options: Options) =>
  emberStoryDocsProvider(next, async (storyPath) => {
    const generator = (await options.presets.apply('storyIndexGenerator')) as
      undefined | { getIndex(): Promise<StoryIndex> };
    const index = await generator?.getIndex();

    return Object.values(index?.entries ?? {}).filter((entry) => entry.importPath === storyPath);
  });

// Storybook calls this with the index entries tagged `manifest` when the
// `componentsManifest` feature is on (e.g. by @storybook/addon-mcp). It also
// probes with no entries to learn whether the framework provides a manifest.
// With the docgen server, the providers describe the components, and Storybook
// only needs to know which docgen produced them.
export const experimental_manifests = async (
  existing: Manifests | undefined,
  options: Options & { manifestEntries?: IndexEntry[] }
): Promise<Manifests> => ({
  ...existing,
  components: (await docgenServerEnabled(options))
    ? ({
        v: 0,
        components: {},
        meta: { docgen: 'ember-docgen', durationMs: 0 }
      } as unknown as ComponentsManifest)
    : await buildComponentsManifest(options.manifestEntries ?? [])
});

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
