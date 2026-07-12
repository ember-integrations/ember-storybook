import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Preprocessor } from 'content-tag';
import { parseSync, Visitor } from 'oxc-parser';

import type { StoryMeta } from './types';
import type { ExportSpecifier, ObjectExpression, Program, VariableDeclarator } from 'oxc-parser';

/*
 * Story files (.stories.gts) define meta and stories like:
 *
 *   export default { component: Greeting, ... } satisfies Meta;
 *   export const LTR: StoryObj = {
 *     render: (args) => <template><Greeting @name={{args.name}} /></template>
 *   };
 *
 * At index time, we need two things from the AST:
 *
 *   1. The component name (e.g. "Greeting") — extracted from the
 *      default export's `component:` property. This is used by the
 *      source decorator to generate `<Component @arg={{val}} />` when
 *      there's no inline template.
 *
 *   2. Inline templates — the raw string content of `<template>`
 *      inside `render()`. content-tag strips the template tags and
 *      replaces them with `template_<hash>(`…`, { eval() { … } })`
 *      calls. We extract the `…` part so the source decorator can
 *      substitute `{{args.X}}` placeholders with actual values.
 *
 * We do this in a single Visitor pass for efficiency — one traversal
 * collects imports, object variable references, export declarations,
 * and inline template calls.
 */

/**
 * Single Visitor pass over the story file's AST.
 *
 * Collects three things into maps, returned together:
 *   - importMap: local name → module path (to resolve the component's source file)
 *   - objectVars: top-level const names → their ObjectExpression values
 *     (e.g. `const meta = { component: X }` — needed because the default
 *     export is often `export default meta satisfies Meta` rather than
 *     an inline object)
 *   - inlineTemplates: story export name → raw template string
 *     (e.g. "LTR" → "<Greeting @name={{args.name}} />")
 *
 * componentId is set once we find the `component:` property in the
 * default export's metadata object.
 */
function collectStoryData(
  program: Program,
  storyExportNames: Set<string>
): {
  componentId: string | undefined;
  importMap: Map<string, string>;
  inlineTemplates: Map<string, string>;
} {
  const importMap = new Map<string, string>();
  const inlineTemplates = new Map<string, string>();

  /*
   * We need to resolve `export default meta satisfies Meta` to the
   * actual object `{ component: Button, ... }`.  The default export
   * only gives us the identifier name "meta".  We find the matching
   * `const meta = { ... }` and stash the ObjectExpression here.
   */
  const objectVars = new Map<string, ObjectExpression>();

  /*
   * Track which named export we're currently inside, so the
   * CallExpression handler knows which story the template belongs to.
   *
   * Visited:   ExportNamedDeclaration("LTR")
   *              ├── VariableDeclaration("LTR")
   *              │     └── CallExpression(template_xxx)  ← tagged "LTR"
   *              └── ...
   * Exited:    ExportNamedDeclaration:exit
   *
   * We push on enter, pop on exit.  A single-pass visitor has no
   * implicit context, so we maintain it ourselves.
   */
  const exportStack: string[] = [];
  let componentId: string | undefined;

  const visitor = new Visitor({
    /*
     * Record imports so we can later resolve identifiers to their
     * source files.  Given `import { Greeting } from './greeting.gts'`,
     * we store: "Greeting" → "./greeting.gts".
     */
    ImportDeclaration(node) {
      for (const spec of node.specifiers) {
        importMap.set(spec.local.name, node.source.value);
      }
    },

    /*
     * Hoist top-level const declarations whose initializer is an
     * ObjectExpression (possibly wrapped in `as` / `satisfies`).
     *
     * In story files, the meta config is often:
     *   const meta = { component: Button, ... };
     *   export default meta satisfies Meta;
     *
     * The default export handler needs the object to find the
     * `component:` property, so we cache it here.
     */
    VariableDeclaration(node) {
      for (const decl of node.declarations) {
        // Skip destructuring — we only care about `const X = {…}`
        if (decl.id.type !== 'Identifier') break;

        let init = decl.init;

        if (!init) continue;

        // Peel off TS type-assertion layers like `as Meta` or `satisfies Meta`
        while (init.type === 'TSAsExpression' || init.type === 'TSSatisfiesExpression') {
          init = init.expression;
        }

        if (init.type === 'ObjectExpression') {
          objectVars.set(decl.id.name, init);
        }
      }
    },

    /*
     * Find the component name from the default export.
     *
     * Story files have: `export default { component: X, ... }`
     * or the deferred form: `const meta = { component: X }; export default meta;`
     *
     * This handler unwraps TS assertions, then looks for the `component:`
     * property — either directly inline or via the hoisted variable.
     *
     * The resulting component name (e.g. "Greeting") is what the source
     * decorator uses to generate `<Greeting @arg={{val}} />`.
     */
    ExportDefaultDeclaration(node) {
      let decl = node.declaration;

      // Peel TS type assertions from the default export value
      while (decl.type === 'TSAsExpression' || decl.type === 'TSSatisfiesExpression') {
        decl = decl.expression;
      }

      if (decl.type === 'Identifier') {
        // export default meta satisfies Meta → find `const meta = {…}`
        const obj = objectVars.get(decl.name);

        if (obj) {
          for (const prop of obj.properties) {
            if (prop.type !== 'Property') continue;
            if (prop.key.type !== 'Identifier' || prop.key.name !== 'component') continue;

            if (prop.value.type === 'Identifier') {
              componentId = prop.value.name;
            }

            break;
          }
        }
      } else if (decl.type === 'ObjectExpression') {
        // export default { component: X, … }
        for (const prop of decl.properties) {
          if (prop.type !== 'Property') continue;
          if (prop.key.type !== 'Identifier' || prop.key.name !== 'component') continue;

          if (prop.value.type === 'Identifier') {
            componentId = prop.value.name;
          }

          break;
        }
      }
    },

    /*
     * Track which story export we're entering.
     *
     * Story exports look like:
     *   export const LTR: StoryObj = { render: (args) => <template>…</template> }
     *
     * We only push to the stack if this export name is one of the
     * stories we're indexing (storyExportNames).  The CallExpression
     * handler below will use the current stack top to assign any
     * template_<hash>(`…`) call to the right story.
     */
    ExportNamedDeclaration(node) {
      if (node.declaration?.type !== 'VariableDeclaration') return;

      if (node.declaration.declarations.length === 0) return;

      const first = node.declaration.declarations[0];

      if (first.id.type === 'Identifier' && storyExportNames.has(first.id.name)) {
        exportStack.push(first.id.name);
      }
    },

    // Pop the export context when we leave the export declaration subtree
    'ExportNamedDeclaration:exit'() {
      exportStack.pop();
    },

    /*
     * Capture inline template content.
     *
     * content-tag transforms `<template>…</template>` into
     * `template_<hash>(`…`, { eval() { … } })`.  We look for any
     * CallExpression whose callee name starts with "template_".
     *
     * The first argument of that call is a TemplateLiteral containing
     * the raw Handlebars/HTML.  We grab the raw string and tag it
     * with the current export name (from the exportStack), so the
     * source decorator can later look it up by story ID.
     *
     * We only capture the first template per export — there should
     * only be one per story, but we guard against duplicates.
     */
    CallExpression(node) {
      const currentExport = exportStack.at(-1);

      if (!currentExport || inlineTemplates.has(currentExport)) return;
      if (node.callee.type !== 'Identifier') return;
      if (!node.callee.name.startsWith('template_')) return;

      if (node.arguments.length === 0) return;

      const firstArg = node.arguments[0];

      if (firstArg.type !== 'TemplateLiteral') return;

      const raw = firstArg.quasis[0]?.value?.raw;

      if (raw) inlineTemplates.set(currentExport, raw);
    }
  });

  visitor.visit(program);

  return { componentId, importMap, inlineTemplates };
}

/**
 * In a component module, the export can be an inline declaration:
 *   export const Greeting = <template>…</template>
 * declarations[0].id.name = "Greeting".
 */
function firstVarExportName(declarations: VariableDeclarator[]): string | undefined {
  if (declarations.length === 0) return undefined;

  const first = declarations[0];

  if (first.id.type === 'Identifier') return first.id.name;

  return undefined;
}

/**
 * In a component module, the export can use a separate specifier:
 *   const Greeting = <template>…</template>;
 *   export { Greeting };
 * specifiers[0].exported.name = "Greeting".
 */
function firstSpecExportName(specifiers: ExportSpecifier[]): string | undefined {
  if (specifiers.length === 0) return undefined;

  const first = specifiers[0];

  if (first.exported.type === 'Identifier') return first.exported.name;

  return undefined;
}

/**
 * Given a path to a component module (e.g. "./greeting.gts"), read it,
 * strip any content-tag template blocks, parse the resulting JS, and
 * return the component's export name.
 *
 * This is needed because the story file only references components by
 * import identifier (e.g. `import { Greeting } from './greeting.gts'`).
 * We need the actual export name from the source module so the source
 * decorator can write `<Greeting … />` rather than `<(unknown) … />`.
 *
 * Component modules export either:
 *   - Named:   `export const Greeting = <template>…</template>`
 *              `export { ComponentName }`
 *   - Default: `export default class ComponentName extends Component {…}`
 *              `export default ComponentName`
 *
 * We scan top-level statements and return the first match.  We only
 * need the first export because template-only components have a single
 * named export, and class components have a single default export.
 */
async function exportNameFromComponent(componentPath: string): Promise<string | undefined> {
  let rawCode: string;

  try {
    rawCode = await readFile(componentPath, 'utf8');
  } catch {
    return undefined;
  }

  let codeToParse = rawCode;

  if (componentPath.endsWith('.gts') || componentPath.endsWith('.gjs')) {
    const pp = new Preprocessor();
    const result = pp.process(rawCode, { filename: componentPath });

    codeToParse = result.code;
  }

  const ast = parseSync(componentPath, codeToParse, {
    lang: componentPath.endsWith('.gts') || componentPath.endsWith('.ts') ? 'ts' : 'js',
    sourceType: 'module'
  });

  for (const stmt of ast.program.body) {
    if (stmt.type === 'ExportNamedDeclaration') {
      // export const Name = <template>…</template>
      if (stmt.declaration?.type === 'VariableDeclaration') {
        const name = firstVarExportName(stmt.declaration.declarations);

        if (name) return name;
      }

      // export { Name }
      const name = firstSpecExportName(stmt.specifiers);

      if (name) return name;
    }

    if (stmt.type === 'ExportDefaultDeclaration') {
      const decl = stmt.declaration;

      // export default class Name extends Component {…}
      if (decl.type === 'ClassDeclaration' && decl.id?.type === 'Identifier') return decl.id.name;

      // export default Name
      if (decl.type === 'Identifier') return decl.name;
    }
  }

  return undefined;
}

/**
 * Entry point called by the indexer for each story file.
 *
 * Given the raw source of a .stories.gts file, we:
 *   1. Strip `<template>` blocks via content-tag's preprocessor
 *      (they aren't valid JS and oxc can't parse them).
 *   2. Parse the resulting JS/TS with oxc.
 *   3. Run a single Visitor pass to collect component references,
 *      import mappings, and inline template strings.
 *   4. If the component is imported from another module, read that
 *      module to discover its actual export name.
 *   5. Build the meta map: storyId → { componentName, inlineTemplate? }.
 *
 * The result is cached to disk and later served as a virtual module
 * so the client-side source decorator can look up metadata by story ID.
 */
export async function extractStoryMeta(
  rawCode: string,
  fileName: string,
  storyIds: Map<string, string>
): Promise<Record<string, StoryMeta>> {
  const pp = new Preprocessor();

  const processed = pp.process(rawCode, { filename: fileName });

  const ast = parseSync(fileName, processed.code, {
    lang: fileName.endsWith('.gts') || fileName.endsWith('.ts') ? 'ts' : 'js',
    sourceType: 'module'
  });

  const { componentId, importMap, inlineTemplates } = collectStoryData(
    ast.program,
    new Set(storyIds.keys())
  );

  /*
   * Resolve the component identifier to its actual export name.
   *
   * The default export references the component by import identifier:
   *   import { Greeting } from './greeting.gts'
   *   export default { component: Greeting, … }
   *
   * We need the export name from './greeting.gts' so the source
   * decorator writes `<Greeting … />`.  If resolution fails, we
   * fall back to the import identifier (which is usually the same).
   */
  let componentName = componentId;

  if (componentId) {
    const source = importMap.get(componentId);

    if (source) {
      componentName =
        (await exportNameFromComponent(path.resolve(path.dirname(fileName), source))) ??
        componentId;
    }
  }

  // Build the final map that gets cached and served as a virtual module
  const meta: Record<string, StoryMeta> = {};

  for (const [exportName, storyId] of storyIds) {
    meta[storyId] = {
      componentName: componentName ?? '',
      inlineTemplate: inlineTemplates.get(exportName)
    };
  }

  return meta;
}
