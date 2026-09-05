# AGENTS.md

Guide for AI agents working in the `ember-storybook` workspace. This is a `pnpm`
monorepo that ships a Storybook framework for Ember components.

## Workspace layout

| Path | Purpose |
| --- | --- |
| `ember-storybook/` | The addon / Storybook framework (the thing being developed) |
| `demo/` | Ember app + Storybook + tests used to exercise the addon |
| `packages/ember-docgen/` | TypeDoc-based docs extraction addon |
| `packages/typedoc-plugin-ember/` | TypeDoc plugin for Ember |

### Critical: how the demo loads the addon

`demo` consumes `ember-storybook` via a pnpm workspace symlink
(`demo/node_modules/ember-storybook -> ../../ember-storybook`). The addon's
`package.json` `exports` map points at **built** files: `./dist/*.mjs` and
`./declarations/*.d.ts`. It never imports `src/` directly.

**⇒ Editing `ember-storybook/src/**` has no effect on the demo until the addon
is rebuilt (`dist/` regenerated).** Always rebuild before expecting the demo to
reflect a change.

## Command toolset

Run from the repo root unless a `workdir`/`cd demo` is noted. Use `pnpm --filter`:

### Addon (ember-storybook)

```bash
pnpm --filter ember-storybook build        # one-shot build (tsdown -> dist/)
pnpm --filter ember-storybook start        # tsdown --watch: rebuild dist/ on every save
pnpm --filter ember-storybook test         # unit tests (vitest, node env)
pnpm --filter ember-storybook test:watch   # vitest watch
pnpm --filter ember-storybook lint:js      # eslint  (run only after a solution is final)
pnpm --filter ember-storybook lint:types   # ember-tsc --noEmit (after solution is final)
```

### Demo (ember-storybook consumer)

```bash
cd demo && pnpm sb --no-open                          # Storybook dev server, headless, :6006
cd demo && pnpm build-storybook                       # static build -> storybook-static/
cd demo && pnpm test                                  # vitest (unit)
# browser smoke tests (addon-vitest + Playwright): see Testing & regression
```

## Playwright MCP & Storybook

- Start Storybook: `pnpm exec storybook dev --no-open` (background it, log to a file inside the repo). The port is dynamic — read the "Local:" line from the log.
- Don't pass `--port` (fails) or `--quiet` (suppresses the URL output).
- Browser is headless (`chrome-for-testing`)
- Always shut down Storybook and the Playwright browser when done.

### Playwright MCP (browser navigation & verification)

- MCP server `playwright` is configured in `opencode.json` → local
  `@playwright/mcp`
- Use the `playwright_browser_*` tools (navigate, snapshot, click, fill,
  evaluate) to drive Storybook headless — do not rely on `curl` for interactive
  behavior.
- Inspect rendered output inside the preview `<iframe>` via `browser_snapshot`.

## Development loop (edit → see the change)

1. Edit `ember-storybook/src/**`.
2. Rebuild: keep `pnpm --filter ember-storybook start` running (watch), or run
   `build` once.
3. Reload / restart depending on which addon tier changed:

| Addon tier | Files | How to see the change |
| --- | --- | --- |
| **Client** | `src/client/**` (notably `render.ts`) | Rebuild, then reload the browser / navigate fresh in MCP (Vite may not HMR linked-package `dist/` reliably) |
| **Node** | `src/preset.ts`, `src/node/**`, indexer, vite plugins | Loaded at Storybook startup → **restart the Storybook dev server** |

## Testing & regression prevention

Regressions have happened (#23 introduced #27), so **add a regression test with
every fix**. Three test layers:

1. **Addon unit tests** — `ember-storybook/src/**/*.test.ts` (vitest, node env).
   Use for pure logic: args merging, source decorator, parser, signature,
   arg-type extraction. `run: pnpm --filter ember-storybook test`.
2. **Demo browser smoke tests** — Storybook's own testing mechanisms via
   `@storybook/addon-vitest` (+ `@storybook/test`, `composeStories`/
   `composeStory`, `renderToCanvas` smoke) executed through the demo's
   Playwright/vitest project. This is the ideal guard for
   render-to-canvas regressions (#27, #31). Configured in `demo/vite.config.js`
   (`storybookScript: 'pnpm storybook --no-open'`).
3. **Packaged-consumer build** — CI job `packaged-consumer` in
   `.github/workflows/ci.yml`: re-installs the workspace with
   `pnpm install --config.inject-workspace-packages=true` (pnpm injects
   workspace deps as real installed package copies — `files`-filtered, own
   `node_modules`, consumer-resolved peers — like a published tarball, not a
   symlink to source), then runs `pnpm --filter demo build-storybook`. Guard
   for anything only a *published* consumer hits (e.g. bare `@ember/*` imports
   in manager-reachable `dist/` chunks breaking Storybook's esbuild manager
   build). Local repro:

   ```bash
   pnpm build
   pnpm install --config.inject-workspace-packages=true --no-frozen-lockfile
   pnpm --filter demo build-storybook
   pnpm install   # back to the symlinked dev layout
   ```

**Policy:** While exploring a solution, skip lint/type. Run
`lint:js` + `lint:types` only after the solution is finalized (they are slow).

## GitHub / issues workflow

- Access issues through the web (webfetch milestone/issue URLs) — e.g.
  milestone 1 "Fix renderToCanvas" covers issues #27, #30, #31, #33.
- Do **not** perform git operations (commits, branches, PRs) — the user handles
  those.
