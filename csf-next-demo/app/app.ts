/**
 * A deliberately minimal Ember app for the CSF Next demo.
 *
 * It registers no router and no services: the two demo components (a
 * template-only `Greeting` and a class-based `Button`) are imported directly
 * in the stories, so the app only needs to provide an owner for
 * `renderComponent`. The `modules` map is empty but present because the strict
 * resolver iterates it eagerly.
 */
import Application from 'ember-strict-application-resolver';

export class App extends Application {
  modules = {};
}

export function createApp(options: Record<string, unknown> = {}) {
  const app = App.create({ ...options, autoboot: false });

  return app.buildInstance();
}
