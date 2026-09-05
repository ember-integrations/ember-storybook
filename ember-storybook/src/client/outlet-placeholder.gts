import type { TOC } from '@ember/component/template-only';

interface OutletPlaceholderSignature {
  Element: HTMLDivElement;
  Args: {
    /** Shown inside the box. A route template only receives `@model`. */
    model?: string;
  };
}

/**
 * A visible stand-in for `{{outlet}}`, for route stories where an empty hole is
 * hard to see (e.g. on the docs page).
 *
 * It is rendered *as a route template*, so it must be template-only (the outlet
 * only accepts a raw template or an internal-manager component) and the only
 * value it can receive is `@model` — pass a string to label the box:
 *
 * ```js
 * parameters: {
 *   ember: { route: { outlet: { template: OutletPlaceholder, model: 'settings' } } }
 * }
 * ```
 */
export const OutletPlaceholder: TOC<OutletPlaceholderSignature> = <template>
  <div
    class="ember-storybook-outlet-placeholder"
    style="border: 1px dashed #999; padding: 0.5rem; color: #666; font: italic 0.8rem/1.4 monospace;"
    data-storybook-outlet
  >
    {{if @model @model "outlet"}}
  </div>
</template>;
