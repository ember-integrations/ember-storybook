---
status: draft
date: 2025-07-15
---

# Adopt Contributor Plugin Architecture With Shared Virtual Module

## Context and Problem Statement

The addon needs to inject Ember component documentation data (source code, metadata, TypeDoc-extracted type signatures) into Storybook's Vite dev server at build time. Three distinct data sources must be processed and served to the browser as a single consumable virtual module. Each data source has its own parsing strategy, lifecycle, and file-watching requirements.

Additionally, the addon must handle HMR: when a user edits a `.gts` component or story file, all three data sources must re-extract and the browser must receive the fresh data.

## Decision Drivers

- **Single consumer interface**: The client code (React docs page, source decorator, argTypes enhancer) should import from one virtual module, not three
- **Independent contributor lifecycle**: Each data source has different processing dependencies and schedules
- **File change coverage**: Watchers must respond to story file creation, change, and deletion, and component file changes
- **Minimal coupling**: Contributors should not need to know about each other

## Considered Options

### Option 1: Monolithic Plugin

A single Vite plugin handles all three data sources internally — resolves imports, loads data, watches files, and serves the virtual module.

### Option 2: Shared Registry + Individual Contributors

Three independent Vite plugins each contribute data to a shared in-memory registry via a common API. A fourth orchestrator plugin merges the registry into a single virtual module and manages HMR invalidation.

### Option 3: Separate Virtual Modules

Each data source gets its own virtual module (`virtual:ember-storybook-meta`, `virtual:ember-storybook-source`, `virtual:ember-storybook-signatures`). The client imports all three.

## Decision Outcome

Chosen option: **Option 2: Contributor Plugin Architecture**, because:

1. **Single virtual module**: Client code imports `virtual:ember-storybook` once and accesses `meta`, `source`, and `signature` from the merged object
2. **Independent lifecycle**: Each contributor is a separate Vite plugin that can initialize, parse, and watch independently — failures in one don't block the others
3. **Plugin ordering guarantees**: The orchestrator registers first, then contributors, ensuring the API is available when contributors need it
4. **Each contributor owns its watchers**: File watching logic lives next to the processing code, not centralized

### Consequences

**Good:**

- Client code has a single import point
- Contributors can be developed and tested independently
- Adding a new data source means adding one plugin file and one `contribute()` call
- The orchestrator is simple: it just merges contributions by name

**Bad:**

- Three plugins firing `contribute()` on every story file change causes redundant invalidation
- Debugging requires tracing through four plugins
- The shared `api` object is mutated by each contributor, making the order of `buildStart` calls significant

**Neutral:**

- The contributor pattern mirrors Vite's own plugin architecture
- File-watching duplication between contributors could be extracted later

## Plugin Architecture

The addon registers four Vite plugins in a specific order via the `emberStorybookPlugin()` factory:

```txt
emberStorybookPlugin() → [
  orchestrator,      // (1) Shared state, virtual module, HMR
  metaContributor,   // (2) Component name extraction
  sourceContributor, // (3) Inline template extraction
  signaturesContributor // (4) TypeDoc signature extraction
]
```

### Plugin: Orchestrator (`ember-storybook`)

**File:** `src/node/vite-plugin-orchestrator.ts`

The orchestrator owns:

- The shared `ContributorAPI` — exposes `contribute(name, data)` and `getContributions()` to all plugins
- The virtual module `virtual:ember-storybook` — on `load()`, merges all contributions by file path
- HMR invalidation — `invalidate()` marks the virtual module stale and triggers a full page reload
- The story file registry — `registerStoryFile()`, `getStoryFiles()`, `isStoryFile()`, `addStoryFileListener()`
- The `handleHotUpdate` hook — detects component file changes and triggers re-extraction

```typescript
export interface ContributorAPI {
  contribute(name: string, data: Record<string, unknown>): void;
  getContributions(): Map<string, Record<string, unknown>>;
  invalidate?: () => void;
}
```

The virtual module's `load()` hook:

```typescript
load(id) {
  if (id !== RESOLVED) return;  // \0virtual:ember-storybook

  const contributions = api.getContributions();
  const merged: Record<string, Record<string, unknown>> = {};

  for (const [name, data] of contributions) {
    for (const [filePath, value] of Object.entries(data)) {
      (merged[filePath] ??= {})[name] = value;
    }
  }

  return {
    code: `export default ${JSON.stringify(merged)};`,
    map: undefined
  };
}
```

### Virtual Module Shape

The merged data has the following structure, consumed by the client code:

```typescript
// virtual:ember-storybook
Record<string, {                    // keyed by absolute story file path
  meta: { componentName: string };   // contributed by meta plugin
  source: Record<storyId, string | undefined>;  // inline template per story
  signature: ComponentSignature;     // TypeDoc-extracted type info
}>
```

### Plugin: Meta Contributor (`ember-storybook:meta`)

**File:** `src/node/meta/vite-plugin.ts`

Extracts the component name from each story file's default export (`component:` property in the meta object). Watches story files for changes and re-extracts.

```typescript
buildStart() {
  // For each known story file, read → parse AST → find component: property → resolve import
  api.contribute('meta', record);
}
configureServer(server) {
  // Watches: .stories.gts add / change / unlink
}
```

### Plugin: Source Contributor (`ember-storybook:source`)

**File:** `src/node/source/vite-plugin.ts`

Extracts inline template source strings (from `render: (args) => <template>...</template>`) per story ID. Watches story files.

```typescript
buildStart() {
  // For each story file, parse CSF → extract inline templates → contribute
  api.contribute('source', record);
}
configureServer(server) {
  // Watches: .stories.gts add / change / unlink
}
```

### Plugin: Signatures Contributor (`ember-storybook:signatures`)

**File:** `src/node/typedoc/vite-plugin.ts`

Extracts TypeScript type signatures (args, blocks, element, style parts, CSS custom properties) from component source files by running TypeDoc. Watches both story and component files.

```typescript
buildStart() {
  // For each story file, resolve the referenced component → run TypeDoc → extract signatures
  api.contribute('signature', record);
}
configureServer(server) {
  // Watches: .stories.gts add / change / unlink, .gts/.gjs add / change / unlink
}
```

### HMR Flow

When a component file changes, the full-reload HMR flow ensures data freshness:

```txts
File change → Vite handleHotUpdate hook
  → invalidateModule(virtual:ember-storybook)  // makes load() return fresh data
  → server.ws.send({ type: 'full-reload' })    // browser reloads
  → browser fetches all modules fresh
  → load() returns current contributions
  → React renders Page with fresh emberData
```

## Plugin Factory

**File:** `src/node/vite-plugin.ts`

The factory creates the shared API and wires all four plugins together:

```typescript
export function emberStorybookPlugin(): Plugin[] {
  const contributions = new Map<string, Record<string, unknown>>();

  const api: ContributorAPI = {
    contribute(name, data) {
      contributions.set(name, data);
      api.invalidate?.();
    },
    getContributions: () => contributions
  };

  return [
    emberStorybookVitePlugin(api),
    metaContributor(api),
    sourceContributor(api),
    signaturesContributor(api)
  ];
}
```

The `invalidate()` call in `contribute()` ensures that every data change triggers the HMR pipeline. During `buildStart`, `api.invalidate` is undefined (the server hasn't started), so the call is a no-op. Once the dev server runs, `configureServer` sets `api.invalidate` to the real invalidation function.

## Preset Integration

**File:** `src/preset.ts`

The preset registers the plugin array and client annotations for Storybook:

```typescript
// viteFinal: adds emberStorybookPlugin() to Vite's plugin list
viteFinal: async (config) => mergeConfig(config, {
  plugins: [...emberStorybookPlugin()],
})

// previewAnnotations: registers client-side docs config with Storybook
previewAnnotations: async (entries, options) => {
  entries.push('ember-storybook/client/config');
  if (docsEnabled) entries.push('ember-storybook/client/docs/config');
}
```

## Client Code Architecture

The client side consists of four modules, all importing from the single virtual module:

| Module | Import from virtual module | Purpose |
|---|---|---|
| `page.ts` | `emberData` (full data) | Docs page rendering (Args, Blocks, Parts, CSS Properties tables) |
| `config.ts` | `emberData` | ArgTypes enhancer — merges signature args into Storybook's controls |
| `extractArgTypes.ts` | `emberData` | Component-name to signature lookup for arg type inference |
| `source-decorator.ts` | `emberData` | Source code generation from inline templates and block signatures |

## Alternatives Considered

### Monolithic Plugin

Rejected because it would couple all three data extraction strategies into one file, making it hard to test and maintain. File-watching logic would also be centralized, making it harder to reason about which change triggers which extraction.

### Separate Virtual Modules

Rejected because it requires the client to import three modules and manage three async data dependencies. The `useOf` hook and preview rendering pipeline would need multiple entry points, adding complexity to the preset configuration.
