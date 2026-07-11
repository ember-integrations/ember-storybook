import './button.css';

import Component from '@glimmer/component';
import { on } from '@ember/modifier';

import { modifier } from 'ember-modifier';

export interface Signature {
  Element: HTMLButtonElement;
  Args: {
    /** Is this the principal call to action on the page? */
    primary?: boolean;
    /** What background color to use */
    backgroundColor?: string;
    /** How large should the button be? */
    size?: 'small' | 'medium' | 'large';
    /** Button contents */
    label: string;
    push(): void;
  };
}

export default class Button extends Component<Signature> {
  backgroundColor = modifier<{ Element: HTMLElement }>((element) => {
    element.style.backgroundColor = this.args.backgroundColor ?? '';
  });

  get className() {
    const mode = this.args.primary ? 'storybook-button--primary' : 'storybook-button--secondary';

    return ['storybook-button', `storybook-button--${this.args.size}`, mode].join(' ');
  }

  <template>
    <button {{on "click" @push}} type="button" class={{this.className}} {{this.backgroundColor}}>
      {{@label}}
    </button>
  </template>
}
