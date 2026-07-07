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
import IntlService from 'ember-intl/services/intl';

import Application from "ember-strict-application-resolver";

import EmbroiderRouter from "@embroider/router";
import type ApplicationInstance from '@ember/application/instance';

export class Router extends EmbroiderRouter {
  location = 'history';
  rootURL = '/';
}

Router.map(function() { });

export class App extends Application {
  modules = {
    './router': { default: Router },
    './services/intl': IntlService,
    ...import.meta.glob("./routes/*", { eager: true }),
    ...import.meta.glob("./templates/**/*", { eager: true }),
    ...import.meta.glob("./services/**/*", { eager: true }),
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
