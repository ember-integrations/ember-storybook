import type { TOC } from '@ember/component/template-only';
import type { ComponentLike } from '@glint/template';

interface NavItemSignature {
  Element: HTMLElement;
  Args: {
    /** The link label */
    label: string;
  };
}

const NavItem: TOC<NavItemSignature> = <template>
  <a part="item" ...attributes>{{yield}}</a>
</template>;

interface AppHeaderSignature {
  Element: HTMLElement;
  Blocks: {
    nav?: [{ Item: typeof NavItem }];
    aux?: [{ Item: ComponentLike<typeof NavItem> }];
  };
}

export const AppHeader: TOC<AppHeaderSignature> = <template>
  <header class="app-header" ...attributes>
    <nav>{{yield (hash Item=NavItem) to="nav"}}</nav>
    <div part="aux">{{yield (hash Item=NavItem) to="aux"}}</div>
  </header>
</template>;