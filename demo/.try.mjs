export default scenarios();

function scenarios() {
  return {
    scenarios: [
      latestEmberScenario('6.8'),
      latestEmberScenario('6.9'),
      latestEmberScenario('6.10'),
      latestEmberScenario('6.11'),
      latestEmberScenario('6.12'),
      latestEmberScenario('7.0'),
      latestEmberScenario('latest'),
      latestEmberScenario('beta'),
      latestEmberScenario('alpha')
    ]
  };
}

function latestEmberScenario(tag) {
  return {
    name: `ember-${tag}`,
    npm: {
      dependencies: {
        'ember-source': `npm:ember-source@${tag}`
      }
    }
  };
}
