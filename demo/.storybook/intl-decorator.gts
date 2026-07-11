import type Owner from '@ember/owner';
import { service } from '@ember/service';
import { next } from '@ember/runloop';
import Component from '@glimmer/component';
import { RenderStory, type Decorator } from 'ember-storybook';
import type IntlService from 'ember-intl/services/intl';

const IntlDecorator: Decorator = (Story, context) => class IntlDecoratol extends
Component {
  // @ts-ignore
  @service declare intl: IntlService;

  constructor(owner: Owner, args: object) {
    super(owner, args);

    next(() => {
      this.intl.setLocale?.(context.globals.locale);
    })
  }

  <template>
    <RenderStory @story={{Story}} @args={{context.args}}/>
  </template>
}

export {IntlDecorator};