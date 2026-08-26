import { hash } from '@ember/helper'; // for ember versions < 7.1

import type { TOC } from '@ember/component/template-only';
import type { ComponentLike } from '@glint/template';

interface NavItemSignature {
  Element: HTMLElement;
  Args: {
    /** The link label */
    label: string;
  };
  Blocks: {
    default: [];
  };
}

const NavItem: TOC<NavItemSignature> = <template>
  <a part="item" ...attributes>{{yield}}</a>
</template>;

interface AppHeaderSignature {
  Element: HTMLElement;
  Blocks: {
    nav?: [{ Item: typeof NavItem }];
    // Declared for the docs page — `ComponentLike<typeof X>` unfolds like
    // `typeof X` but is not invocable in this glint version.
    aux?: [{ Item: ComponentLike<typeof NavItem> }];
  };
}

export const AppHeader: TOC<AppHeaderSignature> = <template>
  <header class="app-header" ...attributes>
    <nav>{{yield (hash Item=NavItem) to="nav"}}</nav>
  </header>
</template>;
