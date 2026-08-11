---
status: draft
date: 2026-07-19
---

# Use Normalized Relative Paths as the Canonical Key Format

## Context and Problem Statement

The ember-storybook project handles file paths originating from multiple sources: Storybook's indexer (absolute filesystem paths), TypeDoc (paths relative to the tsconfig root), Storybook's `parameters.fileName` (path format depends on Storybook version), and import resolution in `parser.ts` (absolute paths from `path.resolve`). These paths must be merged into a single virtual module (`virtual:ember-storybook`) consumed by client-side code to look up story metadata, component signatures, and subcomponent references. Without a canonical format, key mismatches cause silent failures where stories appear but their component signatures or subcomponent sections are missing.

The problem manifests as: a story loads correctly (story entries are found), but component signatures, subcomponents, or arg types are missing because the lookup key (e.g. `./app/components/list.gts`) does not match the key stored in the virtual module (e.g. `./demo/app/components/list.gts`).

## Decision Drivers

- **Deterministic lookup**: Client code (`page.ts`, `config.ts`, `signature.ts`) must be able to look up any entry by a single, predictable path format.
- **Fail-fast on mismatches**: Use `Object.hasOwn()` for key existence checks — avoid fallback searches across all entries that could silently pick the wrong file.
- **Compatibility with Storybook**: The key format must match the format Storybook uses for `parameters.fileName`, which is the primary lookup key for story entries.
- **Eliminate redundant normalization**: The orchestrator (`vite-plugin-orchestrator.ts`) is the single normalization point. All contributors produce absolute paths; the orchestrator normalizes them once.

## Considered Options

### Option 1: Normalized relative paths (`./rel/path`) with centralized normalization

All contributors store data keyed by absolute filesystem paths. The orchestrator applies `normalizeFilePath()` to each key when merging contributions into the virtual module. The virtual module always uses `./rel/path` format for all keys. Client code uses this same format for lookups. Paths within values (e.g. `component.file`, `componentRef.filePath`) are also pre-normalized using `normalizeFilePath()`.

### Option 2: Absolute paths everywhere

Contributors and the virtual module all use absolute filesystem paths (`/Users/thomas/.../app/components/button.gts`). No normalization is applied.

### Option 3: Relative paths without `./` prefix

Use paths like `app/components/button.gts` (no leading `./`) as the canonical format.

## Decision Outcome

Chosen option: **Option 1 — Normalized relative paths with centralized normalization**, because it produces short, consistent keys that work regardless of the directory Storybook is started from, and the `./` prefix unambiguously marks them as relative paths.

### Consequences

- Good, because `normalizeFilePath` (`shared.ts`) is consistently used throughout the codebase — it is the single normalization bottleneck. Contributors don't need to worry about path format; they produce absolute paths and the orchestrator normalizes them.
- Good, because TypeDoc paths (which may be relative to any tsconfig root) are never used as keys — they are matched against absolute entry points by suffix, and the entry point's absolute path becomes the key.
- Bad, because `normalizeFilePath` depends on `PROJECT_ROOT = process.cwd()`, which is evaluated at module import time. If `process.cwd()` changes between module load and plugin execution, the normalization base could drift.
- Neutral, because the `./` prefix is a convention — client-side lookups must use the same `normalizeFilePath()` to be consistent with the virtual module keys.

## Path Flow and Transformation Chain

### Entry registration

```
Storybook indexer → fileName (absolute path, e.g. /abs/demo/app/components/button.stories.gts)
  → registerStoryFile(fileName) → stored in shared.ts storyFiles set
```

### Metadata contribution

```
storyFiles → computeDataForStory(file) → parseStoryFile(file)
  → component.file = normalizeFilePath(path.resolve(path.dirname(file), importSource))
  → returns { meta: { [file]: ... }, component: { [file]: { file: './app/components/button.gts', ... } } }
  // file key = absolute path (from getStoryFiles)
  // file value = normalized relative path (from normalizeFilePath)
```

### Orchestrator merge

```
for each contribution:
  for each [filePath, value]:
    key = normalizeFilePath(filePath)     // absolute → ./rel/path
    if name === 'component' and value.file:
      value.file = normalizeFilePath(value.file)  // normalize again (idempotent)
    merged[key][name] = value
```

### Signature extraction

```
TypeDoc → extractSignatures(json, projectRoot)
  → returns map keyed by TypeDoc paths (e.g. app/components/button.gts.ts)

runner.ts:
  for each extracted entry:
    cleanRel = relPath.replace(/\.gts\.ts$/, '.gts')
    match = entryPoints.find(ep => ep.endsWith(cleanRel))
    mapped[match] = compSigs                // key = absolute entry point path

  // For non-matching entries (transitive subcomponents):
    absKey = path.resolve(typeDocBase, cleanRel)
    mapped[absKey] = compSigs

  // Marker refs (Invokable/TOC/ComponentLike resolved types):
    param.componentRef.filePath = normalizeFilePath(absKey)
```

### Client-side lookup

```
page.ts:
  storyFile = parameters.fileName           // Storybook-provided path
  storyEntry = data[storyFile]              // must match virtual module key format

  compFile = storyEntry.component.file      // './app/components/button.gts'
  compEntry = data[compFile]                // './app/components/button.gts'
  signature = compEntry.signatures[signatureName]

signature.ts collectSubcomponents:
  param.componentRef.filePath               // './app/components/list.gts'
  entry = data[filePath]                    // lookup by normalized relative path
```

## Pros and Cons of the Options

### Option 1: Normalized relative paths with centralized normalization

- Good, because the orchestrator is the sole normalization point — guarantees consistency.
- Good, because `normalizeFilePath` is idempotent for already-normalized paths (double-normalization is safe).
- Good, because all path producers use `normalizeFilePath` or enter the normalization pipeline.
- Bad, because `PROJECT_ROOT` from `shared.ts` is evaluated at module import time — if `process.cwd()` drifts, paths become inconsistent.
- Bad, because the `./` prefix is a convention that must be followed by all lookups.

### Option 2: Absolute paths everywhere

- Good, because absolute paths are unambiguous — no normalization needed.
- Bad, because paths are machine-dependent (username, mount points) — virtual module output differs per developer.
- Bad, because subcomponent `componentRef.filePath` values would be machine-specific — making the JSON output unreproducible.
- Bad, because Storybook's `parameters.fileName` format varies by version and may not be absolute.

### Option 3: Relative paths without `./` prefix

- Good, because paths are shorter and machine-independent.
- Bad, because bare relative paths (`app/components/button.gts`) look like module specifiers, causing ambiguity (Vite may resolve them as imports).
- Bad, because `path.resolve` and `path.relative` in Node.js handle these differently than `./`-prefixed paths — leading to subtle bugs.

## Storybook Path Format

The canonical path format (`./rel/path`) matches Storybook's own internal path convention for `parameters.fileName`. This parameter is declared in Storybook's published type definitions as `fileName?: string` on `StorybookInternalParameters` (exported from the `storybook` package).

`parameters.fileName` is a path relative to the project root (`process.cwd()`), formatted with `./` prefix and forward slashes — the same format Storybook uses for its story index `importPath` entries and the indexer's `fileName` argument. This produces paths like `./demo/app/components/button.stories.gts` or `./app/components/button.stories.gts` depending on where `process.cwd()` is relative to the story file.

In `config.ts`, story metadata is looked up with:

```ts
const filePath = context.parameters.fileName;
if (filePath && Object.hasOwn(data, filePath)) {
  // data is the virtual module, keyed by ./rel/path format
}
```

The virtual module mirrors Storybook's convention — all keys use the same `./rel/path` format that Storybook uses for `parameters.fileName`. This ensures that `data[storyFile]` always finds the correct entry regardless of platform or filesystem layout.

## How to Produce a Path for Contribution

Any code that contributes data to the virtual module must follow this pattern:

**Keys** (outer map keys): Store data keyed by **absolute paths**. The orchestrator normalizes them automatically:

```ts
// Good — store by absolute path, orchestrator normalizes
api.contribute('signatures', {
  '/abs/demo/app/components/list.gts': { List: { ... }, Option: { ... } }
});

// After orchestrator: './app/components/list.gts' → { signatures: { List: {...}, Option: {...} } }
```

**Values** (paths inside data): Use `normalizeFilePath()` to pre-normalize:

```ts
import { normalizeFilePath } from '../shared';

componentRef: {
  filePath: normalizeFilePath(absPath),  // absPath from entry point resolution
  exportName: 'Option'
}
```

**Never:**

- Use TypeDoc raw paths (`app/components/list.gts.ts`) as keys or values
- Use bare relative paths without `./` (`app/components/list.gts`)
- Search across all entries as a fallback — the path must be deterministic

**Path resolution summary:**

| Context | Produce | Example |
|---------|---------|---------|
| Contributor key (outer) | Absolute path | `/abs/demo/app/components/list.gts` |
| `component.file` | `normalizeFilePath(absolute)` | `./app/components/list.gts` |
| `componentRef.filePath` | `normalizeFilePath(entryPointAbs)` | `./app/components/list.gts` |
| Final virtual module key | `normalizeFilePath(absolute)` | `./app/components/list.gts` |
| Client lookup | Use the same `./rel/path` format | `data['./app/components/list.gts']` |
