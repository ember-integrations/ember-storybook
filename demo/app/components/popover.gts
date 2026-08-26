import type { TOC } from '@ember/component/template-only';

interface PopoverSignature {
  Element: HTMLDivElement;
  Blocks: {
    default: [];
  };
}

const Popover: TOC<PopoverSignature> = <template>
  <div class="popover" data-test-popover ...attributes>
    {{yield}}
  </div>
</template>;

export { Popover };
