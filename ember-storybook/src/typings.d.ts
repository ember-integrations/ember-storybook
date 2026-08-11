declare module 'virtual:ember-storybook' {
  import type { EmberMeta } from './node/types';

  const data: EmberMeta;

  export default data;
}

declare let STORYBOOK_ENV: 'ember';
