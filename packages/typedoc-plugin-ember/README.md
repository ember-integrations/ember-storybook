# typedoc-plugin-ember

TypeDoc plugin that lets TypeDoc document Ember **`.gts`** / **`.gjs`** files.

## Installation

```bash
pnpm add -D typedoc-plugin-ember
```

## Usage

In your TypeDoc config:

```json
{
  "plugin": ["typedoc-plugin-ember"],
  "entryPoints": ["app/components/button.gts"]
}
```

## Limitations

- The plugin's `load()` hook does not expand glob entry points; pass explicit
  file path.
- TypeDoc options that operate on raw on-disk paths (e.g. `exclude`) are applied
  against the real `.gts` paths; no virtual paths.

### Workaround

You can use `--entryPoints` CLI parameter.

❌ Does not work

```json
{
  "plugin": ["typedoc-plugin-ember"],
  "entryPoints": ["app/**/*"]
}
```

running with:

```sh
> typedoc
```

✅ Does work

```json
{
  "plugin": ["typedoc-plugin-ember"]
}
```

running with:

```sh
> typedoc --entryPoints app/**/*
```
