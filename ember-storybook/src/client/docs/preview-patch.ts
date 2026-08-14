import { parameters as baseParametersUntyped } from '@storybook/addon-docs/preview';

import { DocsRenderer } from './renderer';

// Re-exports addon-docs' preview `parameters` with `docs.renderer` overridden by
// our stable-key renderer (see DocsRenderer). The framework's Vite plugin
// redirects the addon-docs preview annotation import to this module, so the docs
// page keeps its React tree stable across re-renders instead of remounting it
// (which destroyed the inline story canvases and caused a reload on globals
// changes).
const baseParameters = baseParametersUntyped as {
  docs: { renderer?: () => Promise<unknown> };
};

export const parameters = {
  ...baseParameters,
  docs: {
    ...baseParameters.docs,
    renderer: () => Promise.resolve(new DocsRenderer())
  }
};
