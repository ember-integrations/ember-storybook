import { parameters as baseParameters } from './annotations';
import Page from './page';

import type { Parameters } from 'storybook/internal/types';

// The CSF3 preview-annotations module (loaded via the preset's
// `previewAnnotations`). In CSF Next mode presets are bypassed — the docs tier
// there arrives through `definePreview` injecting `./annotations` plus the
// patched addon-docs factory (see `./addon-preview`).
export { argTypesEnhancers, decorators } from './annotations';

const docs = (baseParameters as { docs?: Record<string, unknown> }).docs;

export const parameters: Parameters = {
  ...baseParameters,
  docs: {
    ...docs,
    page: Page
  }
};
