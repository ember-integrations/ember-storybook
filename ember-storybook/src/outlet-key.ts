/**
 * Name of the Storybook global that decides how `{{outlet}}` is rendered
 * (`hole` | `placeholder`).
 *
 * Lives in its own dependency-free module: the manager toolbar and the client
 * renderer must read and write the same key, but importing it from the client
 * outlet module would pull Ember-only imports (`@ember/*`) into the manager
 * bundle, which Storybook builds with esbuild and cannot resolve them.
 */
export const OUTLET_GLOBAL_KEY = 'outlet';
