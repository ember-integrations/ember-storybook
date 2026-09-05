---
status: draft
date: 2026-09-05
---

# Render Route Stories Through Ember's Outlet Root

## Context and Problem Statement

Story authors want to write stories for **route templates** — templates that live in
`app/templates/`, are rendered by the router, and contain `{{outlet}}` to host their
child route (`demo/app/templates/outer.gts` + `demo/app/templates/outer/nested.gts`
in the demo).

Ember's `{{outlet}}` does not read from any service or registry. It compiles to the
built-in keyword helper `-outlet` and resolves its child route from Glimmer's
**dynamic scope**:

```js
// ember-source, packages/@ember/-internals/glimmer/lib/helpers/outlet.ts
let state = valueForRef(scope.get('outletState'));
return state?.outlets?.main;
```

That scope entry is only seeded by a *root* render: the modern `renderComponent`
(`@ember/renderer`, RFC 1099) starts with an empty `DynamicScopeImpl`, so
`scope.get('outletState')` yields `undefined` and `valueForRef(undefined)` throws.
Consequently a story whose component is a route template did not render an empty
outlet — it **crashed** with `Cannot destructure property 'tag' of 'undefined'`.

The outlet state shape (`OutletState`) is a chain of
`{ render: { name, owner, template, controller, model }, outlets: { main } }`, one
level per nested `{{outlet}}`. Ember's router builds exactly this in
`Router._setOutlets()` and hands it to a top-level `view:-outlet` (`OutletView`).

## Decision Drivers

- **Isolation over fidelity**: a story should show one route template, not the whole
  routed application (no `app/templates/application.gts` shell, no URL, no history).
- **No new dependency on private modules**: reaching for `@ember/-internals/...` at
  runtime is fragile under Embroider/Vite and across Ember versions.
- **Do not disturb the component path**: the `renderComponent`-based mount logic
  encodes hard-won fixes (#27, #30, #31, #33); route support must not change it.
- **Faithful inputs**: a route template can only ever receive `@model` /
  `@controller` — that is all `{{outlet}}` passes down — so args should follow the
  same contract rather than invent a fake arg bag.
- **Predictable failure**: when a story opts in but the environment cannot honour
  it, throw a named error instead of an internal destructure crash.

## Considered Options

### Option 1: Seed Ember's outlet root from the story (stub `{{outlet}}`)

Render route stories through the same view the router uses, obtained via container
lookups only — `application.factoryFor('view:-outlet')` + `template:-outlet` +
`-environment:main` + `application:main` — then `setOutletState(state)` and
`appendTo(mount)`. Leaving `state.outlets.main` **undefined** makes `{{outlet}}`
render nothing: a hole, identical to a route with no active child. Setting
`state.outlets.main.render.template` renders one configurable stub instead.

### Option 2: Drive the real router

`instance.startRouting()` + `instance.visit(url)` per route story, so
`Router._setOutlets()` populates the outlet naturally.

- Good: full fidelity — model hooks, controllers, `LinkTo` active states, query params.
- Bad: always renders the application shell (`app/templates/application.gts` in the
  demo renders `<Page />`), so the story is not the route template but the whole app.
- Bad: needs a `location: 'none'` override per story (the demo router is
  `location = 'history'` and Storybook's iframe URL matches no route), plus async
  transition handling that fights the synchronous canvas/arg-update model.
- Bad: a story per URL, not a story per template — controls cannot drive it.

### Option 3: Rewrite `{{outlet}}` at build time

A template AST transform (or post-compilation wire-format patch) replacing the
`outlet` keyword with an imported stub component.

- Good: no private runtime API; works on any Ember version.
- Bad: the addon cannot contribute an AST transform without the consumer editing
  their own `babel.config.js` (template compilation is the app's, not the
  framework's).
- Bad: makes the Storybook build render *different code* than the app build, and
  docs/source panels would need reconciling.

### Option 4: Register a `helper:-outlet` / `component:-outlet` override

Rejected as **not viable**: keyword helpers resolve through
`ResolverImpl.lookupBuiltInHelper` against a hard-coded `BUILTIN_KEYWORD_HELPERS`
table, before and independent of the owner registry. `parameters.ember.owner`
cannot shadow `{{outlet}}`.

## Decision Outcome

Chosen option: **Option 1 — seed Ember's outlet root, leaving the nested route
unset so `{{outlet}}` renders a hole.**

It is the only option that renders the real `{{outlet}}` keyword (no build fork),
keeps the story isolated to one template, and confines the private-API surface to
four container full names in a single module
(`ember-storybook/src/client/outlet-view.ts`) instead of spreading internals
through the renderer.

Implementation:

- `src/client/types.ts` — `parameters.ember.route?: { name?, model?, controller?, outlet? }`;
  presence of `route` selects the outlet path. `outlet?: { name?, template?, model?, controller? }`
  is a single-level stub supplied by the author.
- `src/client/outlet-state.ts` — pure `buildRouteOutletState` for the `OutletState`
  chain, plus pure `resolveOutletStub` for the hole/marker/override precedence
  (no Ember imports, unit-testable in the node environment).
- `src/client/outlet-view.ts` — imperative shell: create the outlet view,
  `setOutletState`, `appendTo` inside a run loop, `await renderSettled()`.
- `src/client/outlet-placeholder.gts` — `OutletPlaceholder`, an exported visible
  stand-in for authors who want the hole to be seen (docs pages) rather than hidden.
- `src/client/config.ts` — the `outlet` toolbar menu (`globalTypes`), typed through
  `EmberRenderer['globals']`. See the follow-up decision below.
- `src/client/render.ts` — `mountStory()` branches on `route`; the cache records
  `outletView`; arg changes update the **existing** view via `setOutletState`.
- Story args reach the route template as `@model` / `@controller`
  (`route.model ?? args.model`), matching Ember's own contract.

## Consequences

### Good

- `{{outlet}}` works with no router, no URL and no application shell; the stub is
  configurable (a hole by default, the toolbar marker, or any explicit template),
  and the real nested route stays reachable in the demo app at `/outer/nested`
  from the same template files.
- Outlet updates go through `setOutletState`, which is the router's own update
  path, so Controls change the model without re-booting or losing route state.
- No `@ember/-internals` imports: the private surface is four container names
  behind one cast (`OutletContainer`), and a missing `view:-outlet` produces an
  actionable error instead of an internal crash.
- The `renderComponent` path is untouched; `route` is an opt-in parameter.

### Bad

- Depends on private container entries (`view:-outlet`, `template:-outlet`,
  `renderer:-dom`, `application:main`) and on the classic renderer still being the
  outlet's host. Ember is migrating rendering to RFC 1099; when `view:-outlet`
  disappears, route stories break (the failure is loud, not silent).
- An outlet root cannot be detached piecemeal: `Renderer.cleanupRootFor()` empties
  the renderer's root list *without deregistering it*, so a later append asserts
  "Cannot register the same renderer twice". The only safe teardown is destroying
  the app — which is why route stories never reuse a component story's app instance
  (`canReuseApp` in `render.ts`) and `teardownMount` deliberately skips outlet views.
- Route stories bypass the "fresh mount per render" rule that fixed #27/#33; that
  rule exists for `renderComponent`'s per-element render cache, which the outlet
  path does not use, but the asymmetry is a trap for future edits.
- Ordinary story args do not reach a route template (only `@model`/`@controller`),
  so Controls on a route story are Controls on the model object.
- Route stories do not work through `<RenderStory>` (portable stories): a second
  outlet root cannot be nested inside a live render tree, so that path throws
  deliberately.
- [DEFERRED by decision: confirm the outlet-root mechanism down to the peer minimum
  `ember-source >= 6.8.0` — verified on 7.1, and `view:-outlet` / `template:-outlet` /
  `appendOutletView` / `setOutletState` inspected in the 6.12 build only]
- [INVESTIGATE: decide whether portable stories should support route stories via a
  dedicated root rather than throwing]

### Neutral

- `parameters.ember.route` is a rendering-mode switch, not routing configuration:
  there is no route recognition, no transitions, and exactly one level of stubbing
  (Ember itself no longer has named outlets).
- The demo keeps real `Router.map` entries and route handlers, so the same template
  files are exercised by the actual router in `pnpm dev` and by the stub in
  Storybook.

## Follow-up decision: outlet appearance is a global, not a parameter

`{{outlet}}`'s stub started life as `parameters.ember.route.outlet` only. Because
"hole or marker?" is a *viewer* preference (like theme or locale), it was promoted
to a Storybook global with an "Ember" toolbar menu, keeping the parameter as an
override.

### Considered Options

- **Per-story parameter only** (the original): every author who wants a marker must
  edit a story; the reader cannot change it while browsing.
- **Global + toolbar menu, shipped by the framework** (chosen): one declaration in
  `src/client/config.ts` gives every project the menu.
- **Global + toolbar menu, declared per project**: the addon stays UI-neutral but
  every consumer copy-pastes the same `globalTypes` block.
- **A manager-side toolbar button**: full control over the UI, but requires a
  manager entry and manual channel wiring for something `globalTypes` already does.

### Outcome

Chosen: **framework-shipped global**, with an explicit `route.outlet` stub always
winning over the menu, and story/meta `globals` able to pin the value.

Two findings drove the implementation:

1. **Annotation-level `globalTypes` only reach the toolbar on the non-CSF4 code
   path.** `@storybook/builder-vite` generates `getProjectAnnotations()` two ways,
   keyed on `isCsfFactoryPreview()` — i.e. whether the project's preview file
   imports `definePreview`. The non-CSF4 path composes *all* preview annotations
   (`composeConfigs`, and `globalTypes`/`initialGlobals` merge via
   `Object.assign({}, ...getField(list, field))`). The CSF4 path returns
   `preview.default.composed` and ignores the annotation list — which would drop
   framework-declared globals (and, notably, `renderToCanvas` itself). Route
   stories are therefore only as portable as the framework's existing annotation
   mechanism.
2. **`defaultValue` is enough to seed the global.** `GlobalsStore.set()` computes
   `initialGlobals = { ...getValuesFromGlobalTypes(globalTypes), ...globals }`, so
   shipping no `initialGlobals` leaves the key free for a project to override.

### Consequences

- Good: readers can flip a route story between a hole and a marker without the
  author doing anything, and the choice persists in the URL (`&globals=outlet:…`).
- Good: stories that must be deterministic pin `globals: { outlet: … }`; story
  globals override user globals in Storybook's resolution order.
- Bad: the menu is visible on *every* story, including non-route ones, where it does
  nothing. `relevantGlobals()` in `render.ts` strips the key for component stories so
  a toggle cannot remount them, but it cannot hide the item.
- Bad: `OutletPlaceholder` must be loaded via a **dynamic `import()`**. Folding the
  compiled `.gts` into the boot chunk made tsdown emit `import { createRequire } from
  'node:module'` into it; Vite externalizes `node:module` in the browser and throws
  at module evaluation, which took down `renderToCanvas` — and therefore *every*
  story, plus the toolbar item itself (because `config.ts` re-exports `./render`).
  The `.gts` in its own chunk is clean. Any future top-level import of a `.gts` from
  the boot module graph will reintroduce this.
- Neutral: `dynamicTitle` defaults to `true` in Storybook toolbars, which would label
  the item "Hole"; it is pinned to `false` so the menu is named "Ember".

## Related Fix: aliased component imports poisoned docgen

Adding a story that imported its component through the app's subpath alias
(`#app/templates/outer.gts`) surfaced a latent bug: `parseStoryFile` resolved *any*
import source with `path.resolve(dirname(story), source)`, so an aliased specifier
became a non-existent path (`app/stories/#app/templates/outer.gts`). That path was
passed to TypeDoc as an entry point, whose failure aborted extraction for the whole
batch — every story silently lost its signatures/Controls (observed as the
`greetings--plain` argTypes assertion failing).

Two changes make the contract explicit:

- `src/node/parser.ts` — `component.file` is only set for *relative* imports that
  exist on disk (matching its existing docstring); alias/bare specifiers degrade to
  name-only metadata for that one story.
- `src/node/docgen/docgen.ts` — `runTypeDoc` filters entry points to existing files,
  so no single bad path can ever drop signatures for unrelated stories.

Covered by `parseStoryFile > does not resolve an aliased import into a component
file path` in `src/node/parser.test.ts`.
