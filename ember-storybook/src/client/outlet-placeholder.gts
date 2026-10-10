import type { TOC } from '@ember/component/template-only';

interface OutletPlaceholderSignature {
  Element: HTMLDivElement;
  Args: {
    /** Shown inside the box; falls back to the label "outlet". */
    model?: string;
  };
}

/**
 * A visible stand-in for `{{outlet}}`, for route stories where an empty hole is
 * hard to see (e.g. on the docs page).
 *
 * The framework renders it automatically for the toolbar's "placeholder" mode.
 * Authors reach it through the `string` form of `parameters.ember.route.outlet`,
 * which curries the string in as this component's `@model` to label the box:
 *
 * ```js
 * parameters: {
 *   ember: { route: { outlet: 'settings' } }
 * }
 * ```
 *
 * It can also be passed as a component (`outlet: OutletPlaceholder`), which
 * renders it unlabeled.
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
