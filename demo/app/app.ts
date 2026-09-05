/**
 * Looking for services that come from addons?
 *
 * See: https://github.com/embroider-build/embroider/issues/2659
 *
 * We currently don't support app-tree merging from libraries.
 *
 * For services, I highly recommend looking in to either of
 * - https://github.com/chancancode/ember-polaris-service-
 * - https://ember-primitives.pages.dev/6-utils/createService.md
 *   - https://ember-primitives.pages.dev/6-utils/createAsyncService.md
 */
import EmbroiderRouter from '@embroider/router';

import IntlService from 'ember-intl/services/intl';
import Application from 'ember-strict-application-resolver';

import type ApplicationInstance from '@ember/application/instance';

export class Router extends EmbroiderRouter {
  location = 'history';
  rootURL = '/';
}

// The `Router.map` callback uses `this` by design (Ember's routing DSL), which
// the `unicorn`/`no-invalid-this` rules flag because it is not a class body.
/* eslint-disable unicorn/no-this-outside-of-class, @typescript-eslint/no-invalid-this */
// eslint-disable-next-line unicorn/no-top-level-side-effects
Router.map(function () {
  this.route('outer', function () {
    this.route('nested');
  });
});
/* eslint-enable unicorn/no-this-outside-of-class, @typescript-eslint/no-invalid-this */

export class App extends Application {
  modules = {
    './router': { default: Router },
    './services/intl': IntlService,
    ...import.meta.glob('./routes/*', { eager: true }),
    // Colocated stories must not become route templates: the glob is eager, so a
    // `*.stories.gts` here would register a bogus `template:foo.stories` module
    // and pull Storybook/test code into the app bundle.
    ...import.meta.glob(['./templates/**/*', '!./templates/**/*.stories.{gjs,gts,js,ts}'], {
      eager: true
    }),
    ...import.meta.glob('./services/**/*', { eager: true })
  };
}

export function createApp(options: Record<string, unknown> = {}) {
  const app = App.create({ ...options, autoboot: false });

  return app.buildInstance();
}

export async function start(instance: ApplicationInstance) {
  await instance.boot();

  instance.startRouting();
}
