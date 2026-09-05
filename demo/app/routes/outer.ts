import Route from '@ember/routing/route';

export default class OuterRoute extends Route {
  model() {
    return { title: 'from the real router' };
  }
}
