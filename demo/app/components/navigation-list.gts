import { hash } from '@ember/helper'; // for ember versions < 7.1

import { NavLink } from './nav-link.gts';

import type { TOC } from '@ember/component/template-only';

const Title: TOC<{ Blocks: { default: [] } }> = <template>
  <span part="title">{{yield}}</span>
</template>;

interface NavigationListSignature {
  Element: HTMLElement;
  Blocks: {
    default?: [{ Item: typeof NavLink; Title: typeof Title }];
  };
}

export const NavigationList: TOC<NavigationListSignature> = <template>
  <nav class="navigation-list" ...attributes>
    {{yield (hash Item=NavLink Title=Title)}}
  </nav>
</template>;
