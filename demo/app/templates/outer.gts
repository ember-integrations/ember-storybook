import type { TOC } from '@ember/component/template-only';

interface OuterSignature {
  Element: HTMLDivElement;
  Args: {
    /**
     * The route model. Under the router this is resolved by
     * `app/routes/outer.ts`; in a story it comes from `args.model`.
     */
    model?: { title: string };
  };
}

/**
 * A route template: it renders the `outer` route and exposes one outlet for its
 * child route (`templates/outer/nested.gts`, reachable at `/outer/nested`).
 *
 * Route templates only ever receive `@model` / `@controller` — that is all
 * `{{outlet}}` passes down — which is why the route story drives this through
 * `args.model` instead of ordinary args.
 */
const Outer: TOC<OuterSignature> = <template>
  <div class="outer-route" data-test-outer-route>
    <h2>Outer route</h2>

    {{#if @model}}
      <p data-test-outer-model>{{@model.title}}</p>
    {{/if}}

    {{outlet}}
  </div>
</template>;

export default Outer;
