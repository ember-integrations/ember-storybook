declare module 'virtual:ember-storybook' {
  import type { EmberMeta } from './node/types';

  const data: EmberMeta;

  /** Whether signatures come from Storybook's docgen server instead of `data`. */
  export const docgenServer: boolean;

  export default data;
}

declare let STORYBOOK_ENV: 'ember';
