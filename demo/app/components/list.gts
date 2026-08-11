import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { registerDestructor } from '@ember/destroyable';
import { trackedArray } from '@ember/reactive/collections';
import { next } from '@ember/runloop';

import type Owner from '@ember/owner';
import type { WithBoundArgs } from '@glint/template';

export interface OptionSignature<V> {
  Element: HTMLOptionElement;
  Args: {
    /** The value for that option */
    value: V;
    /**
     * @internal
     */
    isSelected: (option: V) => boolean;
    registerItem: (item: V) => void;
    unregisterItem: (item: V) => void;
  };
  Blocks: {
    default: [];
  };
}

export class Option<V> extends Component<OptionSignature<V>> {
  constructor(owner: Owner, args: OptionSignature<V>['Args']) {
    super(owner, args);

    args.registerItem(args.value);

    registerDestructor(this, () => {
      args.unregisterItem(args.value);
    });
  }

  <template>
    <span role="option" aria-selected={{if (@isSelected @value) "true"}}>
      {{yield}}
    </span>
  </template>
}

export interface ListSignature<V> {
  Element: HTMLDivElement;
  Args: {
    /**
     * Enable multiselect
     *
     * @defaultValue false
     */
    multiple?: boolean;
    /**
     * Disable the component
     *
     * @defaultValue false
     */
    disabled?: boolean;
    /** The value for the list */
    value?: V | V[];
    update?: (value: V | V[]) => void;
    activateItem?: (value: V) => void;
  };
  Blocks: {
    default: [
      {
        Option: WithBoundArgs<typeof Option<V>, 'isSelected' | 'registerItem' | 'unregisterItem'>;
      }
    ];
  };
}

export class List<V> extends Component<ListSignature<V>> {
  Option = Option<V>;

  @tracked items: V[] = trackedArray();

  registerItem = (item: V) => {
    // eslint-disable-next-line ember/no-runloop
    next(() => {
      this.items.push(item);
    });
  };

  unregisterItem = (item: V) => {
    // eslint-disable-next-line ember/no-runloop
    next(() => {
      this.items.splice(this.items.indexOf(item), 1);
    });
  };

  isSelected = (option: V) => {
    if (Array.isArray(this.args.value)) {
      return this.args.value.includes(option);
    }

    return this.args.value === option;
  };

  <template>
    <div class="list" data-test-list ...attributes>
      {{yield
        (hash
          Option=(component
            this.Option
            isSelected=this.isSelected
            registerItem=this.registerItem
            unregisterItem=this.unregisterItem
          )
        )
      }}
    </div>
  </template>
}
