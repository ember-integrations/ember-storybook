---
status: draft
date: 2025-07-15
---

# Adopt Full Page Reload for Virtual Module HMR Updates

## Context and Problem Statement

The addon serves component signature data (extracted by TypeDoc) through a Vite virtual module (`virtual:ember-storybook`). When the user edits a `.gts` component file, the signatures contributor re-runs TypeDoc and updates the contributions map. The browser needs to receive the fresh data and the docs page (a React component rendered inside Storybook's docs pipeline) needs to re-render with the updated signatures, parts, and CSS custom properties.

We need a reliable mechanism to propagate these server-side data changes to the browser and trigger a React re-render without data staleness or infinite rendering loops.

## Decision Drivers

- **Data freshness**: The docs page must always display up-to-date component signatures
- **Reliability**: The mechanism must work consistently across file types and edit patterns
- **Minimal complexity**: Avoid fragile event plumbing and state management
- **No infinite loops**: Must not cause React to re-render in a cycle

## Considered Options

### Option 1: Partial HMR via `js-update`

Send a Vite HMR `type: 'update'` message targeting either the virtual module or its importers.

**Attempt A — Update virtual module directly:**
Server sends `js-update` with `path: '/@id/__x00__virtual:ember-storybook'`.
The browser silently ignored the update because the virtual module has no `import.meta.hot.accept()` in its generated code and therefore isn't in the browser's `hotModulesMap`. Without an entry in the map, Vite's HMR client returns early without fetching or evaluating the module.

**Attempt B — Add self-accept to virtual module:**
Added `import.meta.hot.accept()` to the virtual module's generated source. The update was now received, but self-accepting stops HMR propagation at the virtual module — importers (`page.ts`, `config.ts`) are never re-evaluated, so the `emberData` binding remains stale.

**Attempt C — Target importers directly:**
Sent `js-update` for `page.ts` and made it self-accepting via `import.meta.hot.accept()`. Vite's HMR walk from the virtual module reached `page.ts` as the boundary. The browser received the update, re-evaluated `page.ts`, but React's component tree retained the old `Page` function reference and did not re-render.

### Option 2: Custom Event + React State

Send a custom WebSocket event from the server that `page.ts` listens to via `import.meta.hot.on()`. When received, re-import the virtual module and update React state.

**Attempt A — Dynamic import + useState:**
On the custom event, `await import('virtual:ember-storybook')` returns fresh data. Store it in React `useState`. This caused a React infinite re-render loop because state updates during the rendering phase cascaded.

**Attempt B — Ref guards + data comparison:**
Added `useRef` flags and `JSON.stringify` comparison to prevent cascading updates. This partially worked but introduced flickering and occasional stale renders.

**Attempt C — `useSyncExternalStore`:**
React's official hook for subscribing to external stores. Implemented with module-level `currentData`, a `subscribe()` function that registers to a listener set, and a `getSnapshot()` function. The store works correctly, but the fundamental issue remains: when the HMR event fires and the data updates, the React component doesn't re-render because the import binding is stale.

### Option 3: Full Page Reload

After invalidating the virtual module, send `{ type: 'full-reload' }` to the browser. The page reloads, the virtual module's `load()` hook returns fresh contributions, and React renders the Page component from scratch with up-to-date data.

## Decision Outcome

Chosen option: **Option 3: Full Page Reload**, because:

1. **It always works**: A full page reload guarantees the browser receives the latest virtual module data
2. **It avoids React's HMR reactivity gaps**: React's component tree is re-initialized from scratch, so there is no stale closure or stale function reference problem
3. **It eliminates infinite loops**: No state management, no event listeners, no cascading re-renders
4. **It is the simplest implementation**: ~10 lines of code in the orchestrator plugin, no changes to the React component

React's component model is fundamentally incompatible with Vite's HMR for virtual modules when data must propagate through static ES imports. The `useSyncExternalStore` hook solves the reactive subscription problem but cannot overcome the fact that Vite's hot module replacement replaces module exports, not React's component tree. The component function reference is captured in Storybook's render pipeline and partial HMR updates never reach it.

### Consequences

**Good:**

- Reliable data freshness after every component file change
- No infinite re-render loops
- Simple, auditable code (~10 lines in orchestrator, pure static import in page.ts)
- No event listener lifecycle management

**Bad:**

- A brief full-page flicker on each component file change (300-500ms reload)
- All open Storybook pages reload, not just the docs page for the changed component
- Breaks the developer's flow with a visible refresh

**Neutral:**

- The trade-off between reliability and UX polish is acceptable for a development tool
- Future work could revisit partial HMR once React's reconciliation with HMR improves

## Working HMR Update Flow

The following sequence reliably delivers data changes to the browser:

```txt
Component .gts file saved
  ↓
Vite file watcher fires
  ↓
typedoc/vite-plugin.ts: processComponentChange()
  ├── runTypeDoc({ entryPoints: [changedFile] })
  │     └── extracts new signatures from updated source
  └── contributeState()
        ├── buildResult(state) → fresh story-to-signature map
        └── api.contribute('signature', freshResult)
              └── api.invalidate?.()
                    ↓
vite-plugin-orchestrator.ts: invalidate()
  ├── moduleGraph.invalidateModule(virtualMod)
  │     └── marks virtual:ember-storybook as stale
  └── ws.send({ type: 'full-reload' })
        ↓
Browser receives full-reload
  ├── fetches all modules fresh
  ├── virtual-module load() hook runs
  │     └── contributions map contains updated signatures
  └── React renders Page with fresh emberData
```

### Failed Attempts Summary

| Approach | Problem | Root Cause |
|---|---|---|
| `js-update` for virtual module | Update silently ignored | Virtual module not in `hotModulesMap` (no `import.meta.hot.accept()`) |
| Self-accept virtual module | Importers not re-evaluated | HMR propagation stops at self-accept boundary |
| Self-accept page.ts | React not re-rendering | Storybook holds old Page function reference |
| Custom event + useState | Infinite re-render loop | State cascading during render phase |
| Custom event + useSyncExternalStore | Stale data on render | Import binding not refreshed by React |
| Custom event + refs | Flickering + stale renders | Complex state lifecycle management |

A full page reload, while not the most elegant solution, is the only approach that reliably works across all scenarios without introducing complexity or instability.

## Partial HMR Update Code (Reference)

The following code implements the custom event HMR mechanism that successfully delivers fresh data to the browser console but fails at the final step — React does not re-render despite receiving updated module exports.

### Server-Side: Custom Event Sender (`vite-plugin-orchestrator.ts`)

The `handleHotUpdate` hook detects component file changes and sends a custom WebSocket event to the browser:

```typescript
handleHotUpdate(ctx: HmrContext) {
  if (isComponentFile(ctx.file)) {
    console.log('[ember-storybook] handleHotUpdate: component file changed:', ctx.file);

    const virtualMod = ctx.server.moduleGraph.getModuleById(RESOLVED);

    if (virtualMod) {
      ctx.server.moduleGraph.invalidateModule(virtualMod);
    }

    ctx.server.ws.send({
      type: 'custom',
      event: 'ember-storybook:signatures-updated',
      data: { timestamp: Date.now() }
    });

    return [];
  }
}
```

**Key points:**

- `invalidateModule()` marks the virtual module stale — the next `import()` call returns fresh data
- `server.ws.send({ type: 'custom' })` sends a custom event that the browser can listen to
- The `return []` prevents Vite's default HMR handling, giving us full control
- This code successfully delivers the event to the browser

### Client-Side: Event Listener (`page.ts`)

The client listens for the custom event and re-imports the virtual module:

```typescript
// External store — module-level state
let currentData: Record<string, EmberStoryEntry> = {};

// Register HMR listener ONCE at module load time
const hotApi = (import.meta as any).hot;
if (hotApi) {
  hotApi.on('ember-storybook:signatures-updated', async () => {
    const newModule = await import('virtual:ember-storybook');
    currentData = newModule.default;
    console.log('[HMR] Virtual module re-imported, fresh data:', currentData);
  });
}

// Load initial data
import('virtual:ember-storybook').then((mod) => {
  currentData = mod.default;
});

export default function Page() {
  const data = currentData;
  const resolved = useOf('meta', ['meta']);
  const titleName = resolved.preparedMeta?.title?.split('/').pop();
  const entry = titleName
    ? Object.values(data).find((e) => e.meta.componentName === titleName)
    : undefined;

  console.log('Render Docs Page', entry);

  // ...render the docs page with entry data
}
```

**What works:**

- The custom event is successfully delivered from server to browser
- `await import('virtual:ember-storybook')` returns the updated module with fresh data
- The console.log shows the updated `entry` object with new signatures
- The browser console displays: `[HMR] Virtual module re-imported, fresh data: {...}`

**Why this still fails:**

- The `Page` function reads from `currentData`, which is updated
- However, React's component tree was initialized with the original `currentData` reference
- When `currentData` is reassigned, React doesn't know to re-render the `Page` component
- The `Page` function is only called when React decides to re-render, which requires state changes or prop changes
- Reassigning a module-level variable doesn't trigger React's reconciliation
- The console shows the updated data, but the rendered output never changes because React never re-invokes the `Page` function

This is the fundamental React reactivity gap: module-level variables can be updated, but React has no way to know they changed unless they're wrapped in state management (useState, useReducer, useSyncExternalStore, etc.).
