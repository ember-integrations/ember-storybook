---
status: draft
date: 2026-07-12
decision-makers: [thomas]
consulted: []
informed: []
---

# Extract Inline Template Source

## Context and Problem Statement

Story files can define stories with inline `<template>` blocks:

```gjs
export const LTR: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
```

The source decorator needs the raw template string (`<Greeting @name={{args.name}} />`) at documentation-time to substitute `{{args.X}}` placeholders with actual values. This data must be extracted at index/build time and cached as part of the story metadata.

`content-tag` strips `<template>` blocks and replaces them with opaque `template_<hash>(`…`, { eval() { … } })` calls that are valid JS but lose the association between template content and the story export that contained it. We need to:

1. Identify which `template_<hash>` call belongs to which story export
2. Extract the raw template string from the call's first argument
3. Persist the extracted metadata so it survives incremental builds
4. Serve the metadata to the client-side source decorator at runtime

## Decision Drivers

- Extraction must happen at index time, before the browser loads
- Must correctly associate each template with its owning story export
- Must integrate with the existing build pipeline (content-tag preprocessing + oxc-parser parsing)
- Should survive incremental builds — re-indexing only changed files
- Should use library-provided AST traversal rather than manual recursion

## Considered Options

### Template Extraction

- **Single Visitor pass with context tracking** — Use oxc-parser's `Visitor` class to traverse the program once. Track which export we're inside via an enter/exit stack. Capture `CallExpression` nodes whose callee starts with `template_` and attribute them to the current export.
- **Per-export subtree walk** — For each story export, loop over top-level statements, find the matching `ExportNamedDeclaration`, then recursively walk its subtree.
- **Regex on raw source** — Match `<template>…</template>` before content-tag processing.
- **Source map backtracking** — Trace `template_<hash>` calls back to original `<template>` positions via content-tag source maps.

### Metadata Persistence

- **Per-file JSON cache with atomic writes** — Each story file produces a JSON file keyed by story ID, written atomically (write to `.tmp`, rename to final). At build/dev time, the Vite plugin reads all cache files and merges them into a single object.
- **In-memory only** — Extract and serve directly without disk cache.
- **Database or global manifest** — Single manifest file updated by all indexer processes.

## Decision Outcome

Chosen option: "Single Visitor pass with context tracking" for extraction, combined with "Per-file JSON cache with atomic writes" for persistence.

Extraction uses oxc-parser's `Visitor` because it integrates cleanly with the existing parse step, a single typed `Visitor`, and correctly handles export-scoped attribution via the enter/exit stack.

Persistence uses per-file JSON caches because the indexer runs multiple files concurrently and each file writes to a separate cache file (addressed by MD5 hash of the source path). Atomic writes (tmp + rename) prevent partial reads. The Vite plugin merges all cache files into a single virtual module (`virtual:ember-storybook-meta`) that the client imports directly. HMR watches the cache directory and invalidates the virtual module on changes.

```txt
                    Index Time                              Build / Dev Time
┌──────────────┐    ┌──────────────────┐    ┌─────────────────────────────┐
│ .stories.gts │───▶│ extractStoryMeta │───▶│ writeMetaCache(hash.json)   │
│              │    │  (Visitor pass)  │    │  (atomic tmp+rename)        │
└──────────────┘    └──────────────────┘    └─────────────────────────────┘
                                                          │
                                                          ▼
                                            ┌─────────────────────────────┐
                                            │ Vite plugin reads ALL json  │
                                            │ files → merges → serves as  │
                                            │ virtual:ember-storybook-meta │
                                            └─────────────────────────────┘
                                                          │
                                                          ▼
                                            ┌─────────────────────────────┐
                                            │ sourceDecorator imports     │
                                            │ virtual module, looks up    │
                                            │ story ID → inlineTemplate   │
                                            └─────────────────────────────┘
```

### Consequences

- Good, because per-file caches eliminate race conditions — concurrent indexer processes write to different files (keyed by MD5). The Vite plugin simply merges whatever files exist.
- Good, because atomic writes (tmp + rename) prevent the plugin from reading a partially-written cache file during a concurrent build.
- Good, because the virtual module pattern makes the metadata available as a simple ESM import — the source decorator just does `import storyMeta from 'virtual:ember-storybook-meta'` and looks up `storyMeta[context.id]`.
- Good, because HMR watches the cache directory and invalidates the virtual module on file changes, so Storybook's hot reload picks up metadata changes immediately.
- Good, because the `Visitor` provides the exact narrowed type for every AST node (`CallExpression` handler receives `CallExpression`, not a generic node that needs casting).
- Bad, because context in the Visitor must be tracked manually via an export stack — it has no built-in ancestor awareness.

### Confirmation

`build-storybook` in the demo app produces correct cache files and the bundle contains the inlined metadata. The source decorator resolves `{{args.X}}` placeholders against actual story args at runtime. HMR invalidation is verified by touching a cache file during `storybook dev` and observing the virtual module re-import.

## More Information

The three modules involved:

- **`src/node/meta/parser.ts`** — `extractStoryMeta()` + `collectStoryData()` (Visitor pass)
- **`src/node/meta/cache.ts`** — `writeMetaCache()` (atomic write) + `readAllMetaCaches()` (merge all)
- **`src/node/meta/vite-plugin.ts`** — `emberStorybookMetaPlugin()` (virtual module resolver + HMR)

The extracted template string is an intermediate representation — `{{args.X}}` placeholders are substituted client-side by the source decorator, keeping the cache agnostic of specific arg values.
