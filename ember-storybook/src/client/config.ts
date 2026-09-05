import { enhanceArgTypes } from 'storybook/internal/docs-tools';

import { OUTLET_GLOBAL_KEY } from './outlet';

import type { ArgTypesEnhancer, GlobalTypes, Parameters } from 'storybook/internal/types';

export { render, renderToCanvas } from './render';

export const parameters: Parameters = {
  renderer: 'ember',
  docs: {
    story: { inline: true }
  }
};

/**
 * The "Ember" toolbar menu: how a route story should render `{{outlet}}`.
 *
 * `defaultValue` seeds the global (Storybook merges global-type defaults under
 * any project `initialGlobals`), so a project can still change the starting
 * value with `initialGlobals: { outlet: 'placeholder' }`.
 *
 * No `toolbar` here: the menu UI (with the Ember brand icon) is a custom tool
 * in `src/manager`, because Storybook 10 only resolves toolbar icons against
 * its fixed built-in icon map.
 */
export const globalTypes: GlobalTypes = {
  [OUTLET_GLOBAL_KEY]: {
    description: 'How a route story renders {{outlet}}',
    defaultValue: 'hole'
  }
};

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];
