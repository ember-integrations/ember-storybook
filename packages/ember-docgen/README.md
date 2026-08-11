# ember-docgen

Extract component documentation (args, blocks, element, style) from TypeDoc
output for Ember components.

## API

`ember-docgen` is split into two stages:

1. **`parse*`** — run TypeDoc over `.ts`/`.gts`/`.gjs` sources and get back the
   raw TypeDoc project JSON.
2. **`analyze`** — turn that JSON into a component signature map.

```ts
import { parseFile, parseProject, analyze } from 'ember-docgen';
```

### parseFile(file, opts?)

Run TypeDoc on a single file and return the project JSON.

```ts
const json = await parseFile('app/components/button.gts', {
  tsconfigFile: 'tsconfig.json'
});
```

### parseProject(opts?)

Run TypeDoc on the project's entry points — taken from the typedoc config
(`typedocConfigFile` / `typedocConfig`), falling back to the tsconfig's
`include`/`files`.

```ts
const json = await parseProject({
  tsconfigFile: 'tsconfig.json',
  typedocConfigFile: 'typedoc.config.js'
});
```

### analyze(json, opts?)

Convert TypeDoc project JSON into a component signature map, keyed by paths
relative to the tsconfig directory.

```ts
const signatures = analyze(json, { tsconfigFile: 'tsconfig.json' });

// signatures['app/components/button.gts'] => {
//   __DEFAULT__: { args, blocks, element, style }
// }
```

`analyze` also works on JSON produced by your own TypeDoc run (e.g. via
`typedoc --json`). Without `opts`, modifier recovery (e.g. `WithBoundArgs`
wrappers) is skipped; everything else is still extracted.

### Options

`parseFile`, `parseProject`, and `analyze` share a single optional options
object:

| Option               | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `tsconfigFile`       | Path to `tsconfig.json`. Defaults to discovery walking up from cwd. |
| `typedocConfigFile`  | Path to the typedoc config file. Defaults to TypeDoc's discovery.  |
| `typedocConfig`      | Inline typedoc options, merged on top of `typedocConfigFile`.      |

### Other exports

- `Default` — key used for default-export components (`__DEFAULT__`)
- `getBlockParams(params)` — flatten block params (unwraps yield hashes)
- `extractBlockParamModifiers(file)` — extract `WithBoundArgs`/`Omit`/`Pick`
  wrappers from a source file's AST
