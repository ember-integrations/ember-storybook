import { parameters as docsParameters } from '@storybook/addon-docs/preview';
import { definePreviewAddon } from 'storybook/internal/csf';

import Page from './page';
import { parameters as emberDocsParameters } from './preview-patch';

// The CSF Next counterpart of the `docsRendererPlugin` redirect in the preset.
// A csf-next project registers addon-docs through its preview file
// (`import addonDocs from '@storybook/addon-docs'` + `addons: [addonDocs()]`);
// the preset redirects that root import to this module, which wraps the real
// addon-docs preview annotations with the framework's docs configuration: the
// stable-key DocsRenderer fork (see `./preview-patch`) and the Ember autodocs
// page. Keeping the addon-docs import behind the user's own registration means
// `ember-storybook`'s root module graph never statically imports
// `@storybook/addon-docs`.
type DocsParameters = { docs?: Record<string, unknown> };

const parameters = {
  docs: {
    ...(docsParameters as DocsParameters).docs,
    ...(emberDocsParameters as DocsParameters).docs,
    page: Page
  }
};

export default function emberStorybookDocsAddon() {
  return definePreviewAddon({ parameters });
}
