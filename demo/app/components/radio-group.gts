import Component from '@glimmer/component';

import type Owner from '@ember/owner';
import type { WithBoundArgs } from '@glint/template';

interface RadioButtonSignature {
  Element: HTMLButtonElement;
  Args: {
    /** The value for that radio button */
    value: string;
    /** @internal */
    isSelected: (value: string) => boolean;
    /** @internal */
    register: (value: string) => void;
  };
  Blocks: {
    default: [];
  };
}

class RadioButton extends Component<RadioButtonSignature> {
  constructor(owner: Owner, args: RadioButtonSignature['Args']) {
    super(owner, args);
    args.register(args.value);
  }

  <template>
    <button
      type="button"
      role="radio"
      aria-checked={{if (@isSelected @value) "true" "false"}}
      ...attributes
    >
      {{yield}}
    </button>
  </template>
}

interface RadioGroupSignature {
  Element: HTMLDivElement;
  Args: {
    /** The currently selected value */
    value?: string;
  };
  Blocks: {
    default: [
      {
        /** A plain radio button */
        Button: WithBoundArgs<typeof RadioButton, 'isSelected' | 'register'>;
        /** A radio button for the icon variant */
        IconButton: WithBoundArgs<typeof RadioButton, 'isSelected' | 'register'>;
      }
    ];
  };
}

export class RadioGroup extends Component<RadioGroupSignature> {
  Button = RadioButton;
  IconButton = RadioButton;

  registered = new Set<string>();

  register = (value: string) => {
    this.registered.add(value);
  };

  isSelected = (value: string) => this.args.value === value;

  <template>
    <div class="radio-group" ...attributes>
      {{yield
        (hash
          Button=(component this.Button register=this.register isSelected=this.isSelected)
          IconButton=(component this.IconButton register=this.register isSelected=this.isSelected)
        )
      }}
    </div>
  </template>
}
