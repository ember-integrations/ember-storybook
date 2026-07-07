import translationsDe from 'virtual:ember-intl/translations/de';
import translationsEn from 'virtual:ember-intl/translations/en';

import type ApplicationInstance from '@ember/application/instance';

const DEFAULT_LOCALE = 'en';

function configureIntl(app: ApplicationInstance) {
  const intl = app.lookup('service:intl');

  intl.addTranslations('en', translationsEn);
  intl.addTranslations('de', translationsDe);

  intl.setLocale(DEFAULT_LOCALE);
}

export function configure(app: ApplicationInstance) {
  configureIntl(app);
}
