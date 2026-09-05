import { createElement } from 'react';
import { Select } from 'storybook/internal/components';
import { addons, types, useGlobals } from 'storybook/manager-api';

import { OUTLET_GLOBAL_KEY } from '../client/outlet';
import { EmberIcon } from './ember-icon';

import type { OutletMode } from '../client/types';

/**
 * The "Ember" toolbar menu: how a route story should render `{{outlet}}`.
 *
 * Registered as a custom tool (not `globalTypes.toolbar`) because Storybook 10
 * resolves toolbar `icon` strings against a fixed manager-side icon map — the
 * Ember brand icon can only be supplied through a tool's own `render`. The
 * value still lives in globals (see `globalTypes` in `client/config.ts`), so
 * the renderer and `initialGlobals` keep working unchanged.
 */
const ADDON_ID = 'ember-storybook';

const TITLE = 'Ember';
const DESCRIPTION = 'How a route story renders {{outlet}}';

const OUTLET_ITEMS: { value: OutletMode; title: string }[] = [
  { value: 'hole', title: 'Hole' },
  { value: 'placeholder', title: 'Placeholder' }
];

function OutletToolbar() {
  const [globals, updateGlobals, storyGlobals] = useGlobals();

  return createElement(Select, {
    defaultOptions: [globals[OUTLET_GLOBAL_KEY]],
    options: OUTLET_ITEMS,
    // A story-level global override wins; don't let the toolbar fight it.
    disabled: storyGlobals[OUTLET_GLOBAL_KEY] !== undefined,
    ariaLabel: TITLE,
    tooltip: DESCRIPTION,
    onSelect: (selected: unknown) => {
      updateGlobals({ [OUTLET_GLOBAL_KEY]: selected });
    },
    icon: createElement(EmberIcon),
    // Icon-only trigger, like Storybook's own toolbar items (backgrounds,
    // viewport, …): never swap in the selected item's title ("Hole").
    showSelectedOptionTitle: false
  });
}

addons.register(ADDON_ID, () => {
  addons.add(`${ADDON_ID}/outlet-toolbar`, {
    type: types.TOOL,
    title: TITLE,
    render: () => createElement(OutletToolbar)
  });
});
