import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { Preprocessor } from 'content-tag';
import { parseSync, Visitor } from 'oxc-parser';
import { sanitize } from 'storybook/internal/csf';
import { loadCsf, type StaticMeta, type StaticStory } from 'storybook/internal/csf-tools';

import { Default, type ExportedName, normalizeFilePath } from './shared';

import type { ExportSpecifier, Program, VariableDeclarator } from 'oxc-parser';

/**
 * A map with contents of a component file:
 *
 * - `key`: The component name in the file
 * - `value`:
 *   - `string`: The exported component name
 *   - `undefined`: Not exported
 *   - `Default`: default export
 */
export type ComponentMap = Record<ExportedName, string>;

export function readAndPreprocess(filePath: string): { rawCode: string; processedCode: string } {
  const rawCode = readFileSync(filePath, 'utf8');

  if (!filePath.endsWith('.gts') && !filePath.endsWith('.gjs')) {
    return { rawCode, processedCode: rawCode };
  }

  const pp = new Preprocessor();
  const result = pp.process(rawCode, { filename: filePath });

  return { rawCode, processedCode: result.code };
}

export function parseProcessedCode(processedCode: string, filePath: string): Program {
  return parseSync(filePath, processedCode, {
    lang: filePath.endsWith('.gts') || filePath.endsWith('.ts') ? 'ts' : 'js',
    sourceType: 'module'
  }).program;
}

/**
 * Where a component referenced by a story file (its `component`, or one of its
 * `subcomponents`) lives, and how its signature is looked up.
 */
export interface ComponentReference {
  /**
   * Project-relative path to the component file.
   * Set only when the component is imported from a local module.
   */
  file?: string;

  /**
   * The key to look up the component's signature in the component
   * file's signatures record. Matches TypeDoc's deriveComponentName.
   *
   * - `"Greeting"` for `export const Greeting = ...`
   * - `"Card"` for `export { Card as CardExport }`
   * - `"Button"` for `export default class Button ...`
   */
  signatureName?: string;

  /**
   * The name used to invoke the component in generated source.
   * Differs from `signatureName` for default exports, where the
   * signature is keyed by the `__DEFAULT__` sentinel but the real
   * component name (e.g. `"Button"`) is known from the component file.
   */
  name?: string;
}

/**
 * Result of parsing a story file, covering all subsystem needs.
 */
export interface StoryFile {
  meta: StaticMeta;
  component: ComponentReference;

  /**
   * The meta's CSF `subcomponents`, keyed like the meta's own object
   * (`subcomponents: { Item }` → `Item`).
   */
  subcomponents: Record<string, ComponentReference>;

  stories: (StaticStory & { inlineTemplate?: string })[];
}

// ── Private helpers ────────────────────────────────────────────

function firstVarExportName(declarations: VariableDeclarator[]): string | undefined {
  if (declarations.length === 0) return undefined;

  const first = declarations[0];

  if (first.id.type === 'Identifier') return first.id.name;

  return undefined;
}

function firstSpecExportName(specifiers: ExportSpecifier[]): string | undefined {
  if (specifiers.length === 0) return undefined;

  const first = specifiers[0];

  if (first.exported.type === 'Identifier') return first.exported.name;

  return undefined;
}

function firstSpecLocalName(specifiers: ExportSpecifier[]): string | undefined {
  if (specifiers.length === 0) return undefined;

  const first = specifiers[0];

  if (first.local.type === 'Identifier') return first.local.name;

  return undefined;
}

// ── Signature name resolution ──────────────────────────────────

function findSignatureName(
  compMeta: ComponentMap | undefined,
  importedName: string | undefined
): string | undefined {
  if (!compMeta) return undefined;
  if (importedName === Default) return Default;

  return importedName !== undefined && Object.hasOwn(compMeta, importedName)
    ? importedName
    : undefined;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Parse a component file and return a map of all declarations.
 *
 * Each key is the internal variable/class name, each value is:
 * - `string` for named exports (the export name)
 * - `Default` for `export default`
 * - `undefined` for non-exported declarations
 */
export function parseComponentFile(compPath: string): ComponentMap | undefined {
  let program: Program;

  try {
    const { processedCode } = readAndPreprocess(compPath);

    program = parseProcessedCode(processedCode, compPath);
  } catch {
    return undefined;
  }

  const result: ComponentMap = {};
  const handled = new Set<string>();

  const visitor = new Visitor({
    ExportNamedDeclaration(node) {
      if (node.declaration?.type === 'VariableDeclaration') {
        const name = firstVarExportName(node.declaration.declarations);

        if (name && !handled.has(name)) {
          handled.add(name);
          result[name] = name;
        }
      }

      // Directly exported class components (`export class Foo …`)
      if (
        node.declaration?.type === 'ClassDeclaration' &&
        node.declaration.id?.type === 'Identifier'
      ) {
        const name = node.declaration.id.name;

        if (!handled.has(name)) {
          handled.add(name);
          result[name] = name;
        }
      }

      if (node.specifiers.length > 0) {
        const specExported = firstSpecExportName(node.specifiers);
        const specLocal = firstSpecLocalName(node.specifiers);

        if (specLocal && specExported) {
          handled.add(specLocal);
          result[specExported] = specLocal;
        } else if (specExported) {
          handled.add(specExported);
          result[specExported] = specExported;
        }
      }
    },

    VariableDeclaration(node) {
      const name = firstVarExportName(node.declarations);

      if (name && !handled.has(name)) {
        handled.add(name);
        // result[name] = undefined;
      }
    },

    ExportDefaultDeclaration(node) {
      const decl = node.declaration;

      let internalName: string | undefined;

      if (decl.type === 'ClassDeclaration' && decl.id?.type === 'Identifier') {
        internalName = decl.id.name;
      } else if (decl.type === 'Identifier') {
        internalName = decl.name;
      }

      if (internalName && !handled.has(internalName)) {
        handled.add(internalName);
        result[Default] = internalName;
      }
    }
  });

  visitor.visit(program);

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Resolve a component import to a file on disk.
 *
 * Only relative specifiers can be resolved here: subpath aliases (e.g.
 * `#app/templates/outer.gts`) and bare package specifiers need the project's
 * `tsconfig` `paths` / `imports` map, which this parser does not load. Returning
 * `undefined` is important — feeding an unresolved path to TypeDoc as an entry
 * point aborts extraction for *every* story, not just this one.
 */
function resolveLocalComponentFile(storyPath: string, source: string): string | undefined {
  if (!source.startsWith('.')) {
    return undefined;
  }

  const resolved = path.resolve(path.dirname(storyPath), source);

  return existsSync(resolved) ? normalizeFilePath(resolved) : undefined;
}

/**
 * Resolve a component's local name in a story file (as used in the meta's
 * `component` or `subcomponents`) to its file and signature.
 */
function resolveComponentReference(
  storyPath: string,
  importMap: Map<string, { source: string; importedName: string | undefined }>,
  localName: string
): ComponentReference {
  const importInfo = importMap.get(localName);

  if (!importInfo) {
    return { signatureName: localName };
  }

  const compPath = resolveLocalComponentFile(storyPath, importInfo.source);

  if (!compPath) {
    // Not a local relative import (alias or bare specifier), or the file does not
    // exist. No signature can be extracted from it, so report the local name.
    return { signatureName: localName };
  }

  const compMeta = parseComponentFile(compPath);
  const signatureName = findSignatureName(compMeta, importInfo.importedName);

  return {
    file: compPath,
    signatureName: signatureName ?? localName,
    name: signatureName === Default ? (compMeta?.[Default] ?? localName) : undefined
  };
}

/**
 * Read the meta's `subcomponents` object (`{ Item, Other: OtherItem }`) into a
 * map from each key to the local name it references. Entries that are not a
 * plain identifier are skipped.
 */
interface ObjectExpressionNode {
  type: string;
  properties: {
    type: string;
    key: { type: string; name?: string; value?: unknown };
    value: { type: string; name?: string };
  }[];
}

function readSubcomponentNames(node: unknown): Record<string, string> {
  const names: Record<string, string> = {};
  const object = node as ObjectExpressionNode | undefined;

  if (object?.type !== 'ObjectExpression') return names;

  for (const property of object.properties) {
    if (property.type !== 'ObjectProperty' || property.value.type !== 'Identifier') continue;

    const key =
      property.key.type === 'Identifier'
        ? property.key.name
        : property.key.type === 'StringLiteral'
          ? String(property.key.value)
          : undefined;

    if (key && property.value.name) {
      names[key] = property.value.name;
    }
  }

  return names;
}

/**
 * Parse a story file and return metadata about the component it references,
 * including template sources for each named story export.
 */
export function parseStoryFile(storyPath: string): StoryFile | undefined {
  const { processedCode } = readAndPreprocess(storyPath);

  // ── 1. CSF parsing — gives meta, story IDs, local names ──
  let meta: StaticMeta | undefined = {};
  let stories: (StaticStory & { inlineTemplate?: string })[] = [];
  let subcomponentNames: Record<string, string> = {};

  try {
    const csf = loadCsf(processedCode, {
      fileName: storyPath,
      makeTitle: (userTitle: string | undefined) => userTitle ?? 'unknown'
    });
    const parsed = csf.parse();

    meta = parsed.meta;
    stories = parsed.stories;
    subcomponentNames = readSubcomponentNames(csf._metaAnnotations.subcomponents);
  } catch {
    // CSF parsing failed — return partial result
  }

  // ── 2. Oxc walk — imports + inline templates ──
  const program = parseProcessedCode(processedCode, storyPath);
  const importMap = new Map<string, { source: string; importedName: string | undefined }>();
  const exportStack: ((StaticStory & { inlineTemplate?: string }) | undefined)[] = [];

  const visitor = new Visitor({
    ImportDeclaration(node) {
      for (const spec of node.specifiers) {
        const importedName =
          spec.type === 'ImportDefaultSpecifier'
            ? Default
            : spec.type === 'ImportSpecifier'
              ? spec.imported.type === 'Identifier'
                ? spec.imported.name
                : spec.imported.value
              : undefined;

        importMap.set(spec.local.name, { source: node.source.value, importedName });
      }
    },

    ExportNamedDeclaration(node) {
      if (node.declaration?.type !== 'VariableDeclaration') return;
      if (node.declaration.declarations.length === 0) return;

      const first = node.declaration.declarations[0];

      if (first.id.type !== 'Identifier') return;

      const name = (first.id as { name: string }).name;
      const suffix = `--${sanitize(name)}`;
      const story = stories.find((s) => (s.localName ?? s.name) === name || s.id.endsWith(suffix));

      exportStack.push(story);
    },

    'ExportNamedDeclaration:exit'() {
      exportStack.pop();
    },

    CallExpression(node) {
      const currentStory = exportStack.at(-1);

      if (!currentStory || currentStory.inlineTemplate) return;
      if (node.callee.type !== 'Identifier') return;
      if (!node.callee.name.startsWith('template_')) return;
      if (node.arguments.length === 0) return;

      const firstArg = node.arguments[0];

      if (firstArg.type !== 'TemplateLiteral') return;

      const raw = firstArg.quasis[0]?.value?.raw;

      if (raw) currentStory.inlineTemplate = raw;
    }
  });

  visitor.visit(program);

  // ── 3. Resolve component and subcomponents ──
  const resolve = (localName: string) => resolveComponentReference(storyPath, importMap, localName);

  return {
    meta,
    component: meta.component ? resolve(meta.component) : {},
    subcomponents: Object.fromEntries(
      Object.entries(subcomponentNames).map(([key, localName]) => [key, resolve(localName)])
    ),
    stories
  };
}
