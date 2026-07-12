---
status: draft
date: 2026-07-12
decision-makers: [gossi]
consulted: []
informed: []
---

# Generate Story Source from Runtime Args

## Context and Problem Statement

The source decorator generates Ember component invocation code for the docs panel (e.g., `<Greeting @name="Alice" />`). Given a story file without an inline `<template>` in `render()`, the decorator must construct a plausible invocation from the component's available arguments.

Storybook provides two data sources: `args` (current argument values, merged from meta-level defaults and story-level overrides) and `argTypes` (the complete set of available controls, including those without current values). The decorator must decide which arguments to include in the generated source and in what format.

## Decision Drivers

- Show args that the user has explicitly set (whether at meta or story level)
- Avoid generating invalid syntax — bare `@key` is not valid Ember/Glimmer
- Action functions (non-serializable values) must appear as pass-through references, not be silently dropped
- Keep the generated source concise — don't bloat it with every possible control

## Considered Options

- **Only `args` entries** — Iterate `Object.entries(args)` and format each known value; skip keys that only exist in `argTypes`.
- **Union of `args` + `argTypes`** — Show every possible control as either a formatted value or a bare `@key` / `@key={{@key}}` passthrough.
- **Only `args` entries, with explicit show-all-controls opt-in** — Same as first option, but add a `showDefaultControls` parameter for users who want all controls in the source.

## Decision Outcome

Chosen option: **Only `args` entries**.

`args` already contains merged defaults from meta.args plus any per-story overrides. Anything in `args` has a value the user cares about. Keys only in `argTypes` are irrelevant for source display — they'd produce noisy output with no meaningful values.

Only `args` entries are iterated. Each entry is formatted as follows:

| Value type | Format |
|---|---|
| `string` | `@key="value"` |
| `number` / `boolean` | `@key={{42}}` / `@key={{true}}` |
| Function / object (in argTypes) | `@key={{@key}}` (passthrough reference) |
| Function / object (not in argTypes) | omitted |

Inline templates (`render()` with `<template>`) follow the same resolution logic via `resolveTemplateArgs`: `{{args.key}}` is substituted with the actual value, or with `{{@key}}` when the arg is not present in runtime args.

### Consequences

- Good, because the generated source is minimal — only args the user has actually configured appear.
- Bad, because users who want to see all available controls in the source (e.g., for documentation) have no built-in way to opt in.
- Neutral, because the `allKeys` union approach was explored and discarded — it produced noise and required reverting.

### Confirmation

`generateSource` iterates `Object.entries(args)` — verified by unit tests. The `toArgument` helper returns `@key={{@key}}` for any arg value that isn't string/number/boolean but has a matching key in `argTypes`.

## More Information

This decision was refined through several iterations in a single session:

1. Initially actions were filtered out (returning `undefined`) — discarded because actions are valid Ember arguments.
2. The `allKeys` union of `args` + `argTypes` was tried — discarded because it produced noisy output including controls with no meaningful values.
3. Bare `@key` was tried for argTypes-only keys — discarded because bare `@key` is invalid Ember/Glimmer syntax.
4. Final approach: show only `args` entries (always has a value), use `@key={{@key}}` for non-serializable values, skip everything else.
