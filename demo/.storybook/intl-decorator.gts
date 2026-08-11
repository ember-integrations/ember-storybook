import Component from '@glimmer/component';
import { next } from '@ember/runloop';
import { service } from '@ember/service';

import { type Decorator, RenderStory } from 'ember-storybook';

import type Owner from '@ember/owner';
import type IntlService from 'ember-intl/services/intl';

const IntlDecorator: Decorator = (Story, context) =>
  // eslint-disable-next-line @typescript-eslint/no-shadow
  class IntlDecorator extends Component {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    @service declare intl: IntlService;

    constructor(owner: Owner, args: object) {
      super(owner, args);

      // eslint-disable-next-line ember/no-runloop
      next(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-condition
        this.intl.setLocale?.(context.globals.locale);
      });
    }

    <template><RenderStory @story={{Story}} @args={{context.args}} /></template>
  };

export { IntlDecorator };
