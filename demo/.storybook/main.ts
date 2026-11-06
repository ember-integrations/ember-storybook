import type { StorybookConfig } from 'ember-storybook';

const config: StorybookConfig = {
  stories: ['../**/*.stories.g(j|t)s'],

  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
    'storybook-addon-test-codegen'
  ],

  framework: 'ember-storybook',

  // CI builds the demo with the components manifest (`DOCGEN=manifest`) and
  // with the docgen server (`DOCGEN=server`), and compares what agents get.
  features: {
    componentsManifest: process.env.DOCGEN === 'manifest' || process.env.DOCGEN === 'server',
    experimentalDocgenServer: process.env.DOCGEN === 'server'
  },

  core: {
    disableWhatsNewNotifications: true
  },

  previewHead: (head) => `
    ${head}

    <style>
      /* explicitly set monospace font stack to workaround inconsistent fonts in Chromatic */
      pre, code, kbd, samp {
        font-family:
          ui-monospace,
          Menlo,
          Monaco,
          "Cascadia Mono",
          "Segoe UI Mono",
          "Roboto Mono",
          "Oxygen Mono",
          "Ubuntu Monospace",
          "Source Code Pro",
          "Fira Mono",
          "Droid Sans Mono",
          "Courier New",
          monospace;
      }
    </style>
  `
};

export default config;
