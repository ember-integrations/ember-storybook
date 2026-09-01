import Component from '@glimmer/component';

import type { TOC } from '@ember/component/template-only';
import type { WithBoundArgs } from '@glint/template';

export interface ItemSignature {
  Element: HTMLButtonElement;
  Args: {
    /** The item label */
    label?: string;
  };
  Blocks: {
    default: [];
  };
}

export const Item: TOC<ItemSignature> = <template>
  <button type="button" data-test-item>{{yield}}</button>
</template>;

export interface BuilderActions {
  /** Removes all yielded items */
  clear: () => void;
  /** Validates and submits the collected data */
  submit: () => void;
}

export interface BuilderApi {
  /** A single yielded item row */
  Item: WithBoundArgs<typeof Item, 'label'>;
  /** Actions available on the builder */
  Actions: BuilderActions;
  /** How many items have been yielded */
  count: number;
  /** Clears the builder */
  reset: () => void;
}

export interface BuilderSignature {
  Element: HTMLDivElement;
  Blocks: {
    default: [BuilderApi];
  };
}

export class Builder extends Component<BuilderSignature> {
  count = 0;

  reset = () => {
    this.count = 0;
  };

  clear = () => {
    this.count = 0;
  };

  submit = () => {
    this.count = 0;
  };

  <template>
    <div class="builder" data-test-builder ...attributes>
      {{yield
        (hash
          Item=(component Item label="")
          Actions=(hash clear=this.clear submit=this.submit)
          count=this.count
          reset=this.reset
        )
      }}
    </div>
  </template>
}
