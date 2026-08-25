import type { TOC } from '@ember/component/template-only';

// for ember < 7.1
const or = (a: boolean, b: boolean) => a || b;

export interface CardSignature {
  Element: HTMLDivElement;
  Blocks: {
    header?: [];
    footer?: [];
    body?: [];
    default?: [];
  };
  Style: {
    Parts: {
      header: 'For headlines';
      body: 'The main content area';
      footer: 'Ancillary content';
    };
    CustomProperties: {
      '--flow-space': 'Spacing gap between flow elements';
    };
  };
}

const Card: TOC<CardSignature> = <template>
  <div class="card" ...attributes>
    {{#if (has-block "header")}}
      <div part="header">
        {{yield to="header"}}
      </div>
    {{/if}}

    {{#if (or (has-block "body") (has-block))}}
      <div part="body">
        {{#if (has-block "body")}}
          {{yield to="body"}}
        {{else if (has-block)}}
          {{yield}}
        {{/if}}
      </div>
    {{/if}}

    {{#if (has-block "footer")}}
      <div part="footer">
        {{yield to="footer"}}
      </div>
    {{/if}}
  </div>
</template>;

export { Card as CardExport };
// modify
// test
