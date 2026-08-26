import type { TOC } from '@ember/component/template-only';

export interface NavLinkSignature {
  Element: HTMLAnchorElement;
  Args: {
    /** The link target */
    href?: string;
  };
  Blocks: {
    default: [];
  };
}

export const NavLink: TOC<NavLinkSignature> = <template>
  <a href={{@href}} ...attributes>{{yield}}</a>
</template>;