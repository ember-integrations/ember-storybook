import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { parseSync } from 'oxc-parser';

import { createDocgenHost } from './ember-host';

import {
  COMPONENT_BASE_NAME,
  COMPONENT_MODULE,
  GLINT_TEMPLATE_MODULE,
  GLINT_WRAPPER_EXPORTS,
  SIGNATURE_WRAPPER_EXPORTS,
  TEMPLATE_ONLY_MODULE
} from './modules';

import { resolveTsconfigFile } from './config';
import { Default } from './signature';

import type {
  ArgInfo,
  ArgTypeInfo,
  BlockInfo,
  BlockParam,
  ComponentSignature,
  ComponentSignatureMap,
  DocgenOptions,
  HashBlockParam
} from './signature';
import type TS from 'typescript';

// eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module --
// CJS interop, mirrors config.ts
const ts = require('typescript') as typeof TS;

// ── Types ──────────────────────────────────────────────────────

/** Member-container wrappers interpreted by the bundle resolver. */
const CONTAINER_WRAPPERS = new Set(['Simplify', 'Readonly', 'Partial', 'Required']);

/** TypeScript lib globals — ambient, matched by name (no import exists). */
const LIB_WRAPPERS = new Set(['Omit', 'Pick']);

type AstNode = Record<string, unknown> & { start?: number; end?: number; type: string };

interface RawComment {
  type: string;
  value: string;
  start: number;
  end: number;
}

interface Bundle {
  id: string;
  code: string;
  body: AstNode[];
  comments: RawComment[];
  /** Local declaration name → declaring node */
  declarations: Map<string, AstNode>;
  /** Exported name → local declaration name */
  exports: Map<string, string>;
  /** Local name → imported (module source, exported name) */
  imports: Map<string, { source: string; importedName: string }>;
}

type Scope = { bundles: Map<string, Bundle> };

interface ResolvedMember {
  name: string;
  /** The declared type expression of this member */
  typeNode?: AstNode;
  /** The syntax node carrying JSDoc (property/method signature) */
  anchor?: AstNode;
  /** The bundle this member was declared in (offsets belong to it) */
  sourceBundle: Bundle;
  optional: boolean;
}

type EvalContext = {
  scope: Scope;
  bundle: Bundle;
  depth: number;
  /** Generic type-parameter name → concrete type node */
  substitutions: Map<string, AstNode>;
};

// ── parseDeclarations ───────────────────────────────────────────

function isEmberTemplate(file: string): boolean {
  return file.endsWith('.gts') || file.endsWith('.gjs');
}

/**
 * Run TypeScript once over the given component files and collect every
 * emitted declaration file (`--emitDeclarationOnly`). The emitted bundle
 * contains all reachable project types — including non-exported ones —
 * with JSDoc comments preserved.
 *
 * Returns declaration text keyed by module id relative to the tsconfig
 * directory (`app/button.gts`, `app/toc`, …).
 */
export async function parseDeclarations(
  files: string[],
  opts?: DocgenOptions
): Promise<Record<string, string>> {
  const tsconfigFile = resolveTsconfigFile(opts);

  if (!tsconfigFile || files.length === 0) return {};

  const base = path.dirname(tsconfigFile);
  const commandLine = ts.getParsedCommandLineOfConfigFile(tsconfigFile, {}, ts.sys as never);

  if (!commandLine) return {};

  const outDir = mkdtempSync(path.join(tmpdir(), 'ember-docgen-dts-'));

  try {
    const options = {
      ...commandLine.options,
      declaration: true,
      emitDeclarationOnly: true,
      declarationMap: false,
      noEmit: false,
      rootDir: base,
      outDir
    };

    const host = createDocgenHost(ts.createCompilerHost(options, /* setParentNodes */ true), ts);
    const rootNames = files.map((file) => (isEmberTemplate(file) ? `${file}.ts` : file));
    const program = ts.createProgram({ rootNames, options, host });

    program.emit();

    const bundles: Record<string, string> = {};

    // Emitted name → original module id:
    //   app/button.gts.d.ts → app/button.gts · app/toc.d.ts → app/toc
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(full);

          continue;
        }

        if (!entry.name.endsWith('.d.ts')) continue;

        const rel = path.relative(outDir, full).split(path.sep).join('/');

        bundles[rel.replace(/\.d\.ts$/, '')] = readFileSync(full, 'utf8');
      }
    };

    walk(outDir);

    return bundles;
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

// ── Bundle loading ─────────────────────────────────────────────

function nodeName(node: AstNode | undefined): string | undefined {
  return (node?.id as AstNode | undefined)?.name as string | undefined;
}

function declaratorName(node: AstNode): string | undefined {
  if (node.type === 'VariableDeclaration') {
    return nodeName((node.declarations as AstNode[] | undefined)?.[0]);
  }

  return nodeName(node);
}

function loadBundle(id: string, code: string): Bundle {
  const parsed = parseSync(`${id}.d.ts`, code, { lang: 'ts', sourceType: 'module' });
  const bundle: Bundle = {
    id,
    code,
    body: (parsed.program.body ?? []) as unknown as AstNode[],
    comments: (parsed.comments ?? []) as unknown as RawComment[],
    declarations: new Map(),
    exports: new Map(),
    imports: new Map()
  };

  for (const statement of (parsed.program.body ?? []) as unknown as AstNode[]) {
    collectStatement(bundle, statement, false, false);
  }

  return bundle;
}

function collectStatement(
  bundle: Bundle,
  statement: AstNode,
  exported: boolean,
  isDefault: boolean
): void {
  if (
    statement.type === 'ExportNamedDeclaration' ||
    statement.type === 'ExportDefaultDeclaration'
  ) {
    const declaration = statement.declaration as AstNode | undefined;

    if (declaration) {
      collectStatement(
        bundle,
        declaration,
        true,
        isDefault || statement.type === 'ExportDefaultDeclaration'
      );
    }

    for (const specifier of (statement.specifiers ?? []) as AstNode[]) {
      const local = (specifier.local ?? specifier.exported) as AstNode | undefined;
      const exportedName = String(((specifier.exported ?? specifier.local) as AstNode | undefined)?.name ?? '');

      if (local?.name && exportedName) {
        bundle.exports.set(exportedName, String(local.name));
      }
    }

    return;
  }

  if (statement.type === 'ImportDeclaration') {
    const source = String((statement.source as AstNode)?.value ?? '');

    for (const specifier of (statement.specifiers ?? []) as AstNode[]) {
      const local = specifier.local as AstNode | undefined;
      const imported = (specifier.imported ?? specifier.local) as AstNode | undefined;

      if (local?.name && imported?.name) {
        bundle.imports.set(String(local.name), {
          source,
          importedName: String(imported.name)
        });
      }
    }

    return;
  }

  const name = declaratorName(statement);

  if (!name) return;

  // Register the meaningful node — the declarator carries init/annotation
  const registered =
    statement.type === 'VariableDeclaration'
      ? ((statement.declarations as AstNode[])[0] as AstNode)
      : statement;

  bundle.declarations.set(name, registered);

  if (exported) {
    bundle.exports.set(isDefault ? 'default' : name, name);
  }
}

// ── Name resolution ────────────────────────────────────────────

/** Resolve an import source to one of our bundle ids (trying known extensions). */
function normalizeImportSource(fromBundleId: string, source: string): string {
  if (!source.startsWith('.')) return source;

  const dir = path.posix.dirname(fromBundleId);
  const base = path.posix.normalize(`${dir}/${source}`).replace(/^\.\//, '');

  for (const candidate of [base, `${base}.gts`, `${base}.gjs`, `${base}.ts`]) {
    if (candidateBundles.has(candidate)) return candidate;
  }

  return base;
}

/** Registry of known bundle ids, used during import normalization. */
const candidateBundles = new Set<string>();

function resolveName(
  scope: Scope,
  bundle: Bundle,
  name: string
): { node: AstNode; bundle: Bundle } | undefined {
  let current: Bundle = bundle;
  const visited = new Set<string>();

  for (;;) {
    const key = `${current.id}::${name}`;

    if (visited.has(key)) return undefined;

    visited.add(key);

    const local = current.declarations.get(name);

    if (local) return { node: local, bundle: current };

    const imported = current.imports.get(name);

    if (!imported) return undefined;

    const target = scope.bundles.get(normalizeImportSource(current.id, imported.source));

    if (!target) return undefined;

    const localName = target.exports.get(imported.importedName);

    if (!localName) return undefined;

    name = localName;
    current = target;
  }
}

/** The exported name under which a declaration is visible in its own bundle. */
function exportNameOf(resolved: { node: AstNode; bundle: Bundle }): string | undefined {
  for (const [exported, localName] of resolved.bundle.exports) {
    if (resolved.bundle.declarations.get(localName) === resolved.node) {
      return exported === 'default' ? Default : exported;
    }
  }

  return undefined;
}

// ── Node helpers ───────────────────────────────────────────────

/** Dotted name text of an identifier / qualified-name node. */
function nameText(node: AstNode | undefined): string {
  if (!node) return '';

  const object = node.object as AstNode | undefined;
  const property = node.property as AstNode | undefined;

  if (object && property) {
    return `${nameText(object)}.${nameText(property)}`;
  }

  return String(node.name ?? '');
}

function typeAnnotationOf(member: AstNode | undefined): AstNode | undefined {
  return (member?.typeAnnotation as { typeAnnotation?: AstNode } | undefined)?.typeAnnotation;
}

function stringLiterals(node: AstNode | undefined): string[] {
  if (!node) return [];

  if (node.type === 'TSLiteralType') {
    const literal = node.literal as AstNode | undefined;

    return literal?.type === 'Literal' && typeof literal.value === 'string'
      ? [literal.value]
      : [];
  }

  if (node.type === 'TSUnionType') {
    return ((node.types ?? []) as AstNode[]).flatMap((t) => stringLiterals(t));
  }

  return [];
}

// ── Comments / docs ────────────────────────────────────────────

function commentBefore(bundle: Bundle, node: AstNode): RawComment | undefined {
  if (node.start === undefined) return undefined;

  let found: RawComment | undefined;

  for (const comment of bundle.comments) {
    if (
      comment.end <= node.start &&
      comment.end > (found?.end ?? -1) &&
      bundle.code.slice(comment.end, node.start).trim() === ''
    ) {
      found = comment;
    }
  }

  return found;
}

function cleanCommentText(value: string): string {
  // Strip JSDoc tag lines, leading asterisks and markers
  return value
    .replace(/@(?:default|defaultValue)\b[\s\S]*$/m, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean)
    .join(' ');
}

function descriptionFor(bundle: Bundle, node: AstNode | undefined): string {
  const comment = node ? commentBefore(bundle, node) : undefined;

  return comment ? cleanCommentText(comment.value).trim() : '';
}

function defaultValueFor(bundle: Bundle, node: AstNode | undefined): string | undefined {
  const comment = node ? commentBefore(bundle, node) : undefined;

  if (!comment || comment.type !== 'Block') return undefined;

  const match = comment.value.match(/@(?:default|defaultValue)\s+([\s\S]*?)\s*(?:\*\/|$)/);

  if (!match) return undefined;

  return collapseWhitespace(match[1]);
}

// ── Signature discovery ────────────────────────────────────────

/** Dotted name of the type referenced by a TSTypeReference node. */
function referenceName(node: AstNode | undefined): string {
  return nameText(node?.typeName as AstNode | undefined);
}

/**
 * Whether `localName` in this bundle is an import of one of the canonical
 * export names from the given module specifier.
 */
function importedFrom(
  bundle: Bundle,
  localName: string,
  moduleName: string,
  acceptedExports: readonly string[]
): boolean {
  const imported = bundle.imports.get(localName);

  return (
    imported !== undefined &&
    imported.source === moduleName &&
    acceptedExports.includes(imported.importedName)
  );
}

/**
 * The signature-wrapper type of a variable declarator — via explicit
 * annotation or an `as` cast chain (`{} as unknown as TOC<S>`) — verified
 * against the import origin of the referenced name.
 */
function declaredSignatureWrapper(declarator: AstNode, bundle: Bundle): AstNode | undefined {
  const isWrapper = (node: AstNode): boolean =>
    node.type === 'TSTypeReference' &&
    importedFrom(bundle, referenceName(node), TEMPLATE_ONLY_MODULE, SIGNATURE_WRAPPER_EXPORTS);

  // oxc attaches the declarator's annotation to its identifier
  const id = declarator.id as AstNode | undefined;
  const annotation = typeAnnotationOf(declarator) ?? typeAnnotationOf(id);

  if (annotation && isWrapper(annotation)) {
    return annotation;
  }

  let current = declarator.init as AstNode | undefined;

  while (current?.type === 'TSAsExpression') {
    const target = current.typeAnnotation as AstNode | undefined;

    if (target && isWrapper(target)) {
      return target;
    }

    current = current.expression as AstNode | undefined;
  }

  return undefined;
}

interface DiscoveredComponent {
  name: string;
  signatureNode: AstNode;
}

function discoverComponents(scope: Scope, bundle: Bundle): DiscoveredComponent[] {
  const components: DiscoveredComponent[] = [];
  const exportOf = (node: AstNode): string | undefined => {
    for (const [exported, localName] of bundle.exports) {
      if (bundle.declarations.get(localName) === node) {
        return exported;
      }
    }

    return undefined;
  };

  function push(rawName: string, signatureNode: AstNode): void {
    components.push({ name: rawName === 'default' ? Default : rawName, signatureNode });
  }

  for (const [exportedName, localName] of bundle.exports) {
    const statement = bundle.declarations.get(localName);

    if (!statement) continue;

    // Class extending `Component<Signature>` — verified against
    // `@glimmer/component` by import origin.
    if (statement.type === 'ClassDeclaration') {
      const superTypeArgs = statement.superTypeArguments as
        | { params?: AstNode[] }
        | undefined;
      const superName = nameText(statement.superClass as AstNode | undefined);
      const arg = superTypeArgs?.params?.[0];

      if (
        arg &&
        importedFrom(bundle, superName, COMPONENT_MODULE, [
          COMPONENT_BASE_NAME,
          'default'
        ])
      ) {
        push(exportedName, arg);
      }

      continue;
    }

    if (statement.type !== 'VariableDeclarator') continue;

    const declarator: AstNode = statement;
    const wrapper = declaredSignatureWrapper(declarator, bundle);

    if (!wrapper) continue;

    const arg = (
      (wrapper.typeArguments as { params?: AstNode[] } | undefined)?.params ?? []
    )[0] as AstNode | undefined;

    if (!arg) continue;

    push(exportedName, arg);
  }

  return components;
}

// ── Container resolution ───────────────────────────────────────

function membersOf(node: AstNode, ctx: EvalContext): ResolvedMember[] {
  if (node.type !== 'TSTypeLiteral' && node.type !== 'TSInterfaceBody') {
    return [];
  }

  const members = ((node.members ?? node.body ?? []) as AstNode[]).flatMap((member) => {
    if (member.type !== 'TSPropertySignature' && member.type !== 'TSMethodSignature') {
      return [];
    }

    const memberName = member.key ? nameText(member.key as AstNode) : '';

    if (!memberName) return [];

    return [
      {
        name: memberName,
        anchor: member,
        sourceBundle: ctx.bundle,
        typeNode:
          member.type === 'TSMethodSignature' ? methodTypeNode(member, ctx) : typeAnnotationOf(member),
        optional: member.optional === true
      }
    ];
  });

  return members;
}

/** Synthesize `(params) => returnType` text nodes for method signatures. */
function methodTypeNode(member: AstNode, ctx: EvalContext): AstNode & { __text?: string } {
  const params = ((member.params ?? []) as AstNode[])
    .map((param) => sliceText(ctx.bundle, param))
    .join(', ');
  const returnType = (member.returnType as
    | { typeAnnotation?: AstNode }
    | undefined)?.typeAnnotation;

  const text = `(${params}) => ${returnType ? sliceText(ctx.bundle, returnType) : 'void'}`;

  return { type: '__synthetic', __text: text };
}

function sliceText(bundle: Bundle, node: AstNode | undefined): string {
  if (!node || node.start === undefined || node.end === undefined) return 'unknown';

  return collapseWhitespace(bundle.code.slice(node.start, node.end));
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Resolve a "member container" type expression into its members by
 * following references within the declaration bundle.
 */
function evalContainer(node: AstNode | undefined, ctx: EvalContext): ResolvedMember[] {
  if (!node || ctx.depth > 8) return [];

  switch (node.type) {
    case 'TSTypeLiteral':
    case 'TSInterfaceBody': {
      return membersOf(node, ctx);
    }

    case 'TSUnionType':
    case 'TSIntersectionType': {
      return ((node.types ?? []) as AstNode[]).flatMap((part) =>
        evalContainer(part, ctx)
      );
    }

    case 'TSMappedType': {
      // Homomorphic mapped types (`{ [K in keyof T]: T[K] }`) — the
      // dominant shape of utility wrappers in emitted declarations — map
      // one-to-one over their source type's members.
      const typeParam = (
        (node.typeParameters as { params?: AstNode[] } | undefined)?.params ??
        []
      )[0] as AstNode | undefined;
      const paramName = String(typeParam?.name ?? '');
      const constraint = typeParam?.constraint as AstNode | undefined;
      const sourceName =
        constraint?.type === 'TSTypeOperator'
          ? nameText((constraint.target ?? {}) as AstNode)
          : '';

      if (paramName && ctx.substitutions.has(sourceName)) {
        return evalContainer(ctx.substitutions.get(sourceName), step(ctx));
      }

      return [];
    }

    case 'TSIndexedAccessType': {
      const objectMembers = evalContainer(node.objectType as AstNode, step(ctx));
      const indexLiteral = (node.indexType as AstNode | undefined)?.literal as
        | AstNode
        | undefined;

      return objectMembers.filter(
        (member) => member.name === String(indexLiteral?.value ?? '')
      );
    }

    case 'TSTypeReference': {
      const name = referenceName(node);

      // A bound generic parameter (`T` inside an instantiated alias)
      const substituted = ctx.substitutions.get(name);

      if (substituted) return evalContainer(substituted, step(ctx));

      // Wrapper utilities
      const args = ((node.typeArguments as { params?: AstNode[] } | undefined)?.params ??
        []) as AstNode[];

      if ((name === 'Omit' || name === 'Pick') && args.length >= 2) {
        const keys = new Set(stringLiterals(args[1]));
        const members = evalContainer(args[0], step(ctx));

        return members.filter((member) =>
          name === 'Omit' ? !keys.has(member.name) : keys.has(member.name)
        );
      }

      if (CONTAINER_WRAPPERS.has(name) && args.length > 0) {
        return evalContainer(args[0], step(ctx));
      }

      const resolved = resolveName(ctx.scope, ctx.bundle, name);

      if (!resolved) return [];

      const innerCtx: EvalContext = {
        scope: ctx.scope,
        bundle: resolved.bundle,
        depth: ctx.depth + 1,
        substitutions: bindTypeParameters(resolved.node, args)
      };

      if (resolved.node.type === 'TSInterfaceDeclaration') {
        const own = evalContainer(resolved.node.body as AstNode, innerCtx);
        const inherited = ((resolved.node.extends ?? []) as AstNode[]).flatMap((clause) =>
          evalContainer(clause.expression as AstNode, innerCtx)
        );

        const merged = new Map<string, ResolvedMember>();

        for (const member of [...inherited, ...own]) {
          merged.set(member.name, member);
        }

        return [...merged.values()];
      }

      if (resolved.node.type === 'TSTypeAliasDeclaration') {
        return evalContainer(resolved.node.typeAnnotation as AstNode, innerCtx);
      }

      return [];
    }

    default: {
      return [];
    }
  }
}

function step(ctx: EvalContext): EvalContext {
  return { scope: ctx.scope, bundle: ctx.bundle, depth: ctx.depth + 1, substitutions: ctx.substitutions };
}

/** Bind a declaration's type parameters to concrete type arguments. */
function bindTypeParameters(declaration: AstNode, args: AstNode[]): Map<string, AstNode> {
  const substitutions = new Map<string, AstNode>();
  const params = ((declaration.typeParameters as { params?: AstNode[] } | undefined)
    ?.params ?? []) as AstNode[];

  for (const [index, param] of params.entries()) {
    const paramName = String((param.name as AstNode)?.name ?? '');
    const arg = args[index];

    if (paramName && arg) {
      substitutions.set(paramName, arg);
    }
  }

  return substitutions;
}

// ── Arg serialization ──────────────────────────────────────────

function describeType(node: AstNode | undefined, ctx: EvalContext, depth = 0): ArgTypeInfo {
  if (!node) return { category: 'other', raw: 'unknown' };

  // Synthetic method-signature nodes carry their text directly
  const synthetic = (node as { __text?: string }).__text;

  if (synthetic !== undefined) {
    return { category: 'function', raw: synthetic };
  }

  const raw = sliceText(ctx.bundle, node);

  switch (node.type) {
    case 'TSStringKeyword':
      return { category: 'string', raw };
    case 'TSNumberKeyword':
      return { category: 'number', raw };
    case 'TSBooleanKeyword':
      return { category: 'boolean', raw };
    case 'TSFunctionType':
    case 'TSMethodSignature': {
      return { category: 'function', raw };
    }
    case 'TSLiteralType': {
      return { category: 'other', raw };
    }
    case 'TSUnionType': {
      const types = (node.types ?? []) as AstNode[];
      const literals = stringLiterals(node);
      const defined = types.filter((t) => t.type !== 'TSUndefinedKeyword' && t.type !== 'TSNullKeyword');

      if (literals.length > 0 && literals.length === types.length) {
        return { category: 'enum', raw, options: literals };
      }

      if (defined.length === 1) {
        return describeType(defined[0], ctx, depth + 1);
      }

      return { category: 'union', raw };
    }
    case 'TSTupleType':
      return { category: 'array', raw, elementType: { category: 'other', raw } };
    case 'TSArrayType':
      return {
        category: 'array',
        raw,
        elementType: describeType(node.elementType as AstNode, ctx, depth + 1)
      };
    case 'TSTypeLiteral':
    case 'TSTypeReference': {
      // A type alias resolving directly to a classifiable expression
      // (e.g. `type ToggleFn = (value: boolean) => void`)
      if (depth < 4) {
        const resolved = resolveName(ctx.scope, ctx.bundle, referenceName(node));

        if (
          resolved?.node.type === 'TSTypeAliasDeclaration' &&
          resolved.node.typeAnnotation &&
          evalContainer(resolved.node.typeAnnotation as AstNode, {
            scope: ctx.scope,
            bundle: resolved.bundle,
            depth: depth + 1,
            substitutions: new Map()
          }).length === 0
        ) {
          const annotation = resolved.node.typeAnnotation as AstNode;

          if (annotation.type === 'TSFunctionType') {
            return { category: 'function', raw };
          }

          if (/Keyword$/u.test(annotation.type)) {
            return describeType(annotation, {
              scope: ctx.scope,
              bundle: resolved.bundle,
              depth: depth + 1,
              substitutions: new Map()
            });
          }
        }
      }

      const members =
        depth < 4
          ? evalContainer(node, { scope: ctx.scope, bundle: ctx.bundle, depth: depth + 1, substitutions: ctx.substitutions })
          : [];

      if (members.length > 0) {
        const properties: Record<string, ArgTypeInfo> = {};

        for (const member of members) {
          properties[member.name] = describeType(member.typeNode, ctx, depth + 1);
        }

        return { category: 'object', raw, properties };
      }

      return { category: 'other', raw };
    }
    default:
      return { category: 'other', raw };
  }
}

function buildArgInfo(member: ResolvedMember, scope: Scope): ArgInfo {
  const bundle = member.sourceBundle;

  return {
    type: describeType(member.typeNode, {
      scope,
      bundle,
      depth: 0,
      substitutions: new Map()
    }),
    required: !member.optional,
    description: descriptionFor(bundle, member.anchor),
    defaultValue: defaultValueFor(bundle, member.anchor)
  };
}

// ── Block params ───────────────────────────────────────────────

function componentRefFromTypeNode(
  node: AstNode | undefined,
  ctx: EvalContext
): BlockParam['componentRef'] | undefined {
  if (!node) return undefined;

  if (node.type === 'TSTypeQuery') {
    return resolveComponentName(nameText(node.exprName as AstNode), ctx);
  }

  if (node.type === 'TSTypeReference') {
    const name = referenceName(node);
    const args = ((node.typeArguments as { params?: AstNode[] } | undefined)?.params ??
      []) as AstNode[];

    // `WithBoundArgs<typeof X, 'keys'>` — verified against `@glint/template`
    // by import origin. `Omit`/`Pick` are TypeScript lib globals (name match).
    if (
      args.length > 0 &&
      ((name === 'WithBoundArgs' &&
        importedFrom(ctx.bundle, name, GLINT_TEMPLATE_MODULE, GLINT_WRAPPER_EXPORTS)) ||
        LIB_WRAPPERS.has(name))
    ) {
      for (const arg of args) {
        const inner = componentRefFromTypeNode(arg, ctx);

        if (inner) {
          const typeArgs = args
            .filter((other) => other !== arg)
            .flatMap((other) => stringLiterals(other));

          return { ...inner, modifiers: [{ name, typeArgs }] };
        }
      }

      return undefined;
    }

    return resolveComponentName(nameText(node.typeName as AstNode), ctx);
  }

  if (node.type === 'TSUnionType' || node.type === 'TSIntersectionType') {
    for (const part of (node.types ?? []) as AstNode[]) {
      const inner = componentRefFromTypeNode(part, ctx);

      if (inner) return inner;
    }
  }

  return undefined;
}

function resolveComponentName(
  name: string,
  ctx: EvalContext
): { filePath: string; exportName: string } | undefined {
  const resolved = resolveName(ctx.scope, ctx.bundle, name);

  if (!resolved) return undefined;

  const exportName = exportNameOf(resolved);

  if (!exportName) return undefined;

  return { filePath: resolved.bundle.id, exportName };
}

function blockParamFromTypeNode(
  name: string,
  node: AstNode,
  ctx: EvalContext
): BlockParam {
  return {
    name,
    type: sliceText(ctx.bundle, node),
    description: '',
    componentRef: componentRefFromTypeNode(node, ctx)
  };
}

function parseBlockParams(typeNode: AstNode, ctx: EvalContext): BlockInfo['params'] {
  const params: BlockInfo['params'] = [];

  if (typeNode.type === 'TSTupleType') {
    for (const element of (typeNode.elementTypes ?? []) as AstNode[]) {
      if (element.type === 'TSNamedTupleMember') {
        const label = (element.label ?? element.name) as AstNode | undefined;
        const elementName = String(label?.name ?? '');

        if (!elementName || !element.elementType) continue;

        params.push({
          ...blockParamFromTypeNode(elementName, element.elementType as AstNode, ctx),
          description: descriptionFor(ctx.bundle, element)
        });
      } else if (element.type === 'TSTypeLiteral') {
        // Yield hash: one entry per named member
        const hash: HashBlockParam = {};

        for (const member of (element.members ?? []) as AstNode[]) {
          const memberName = member.key ? nameText(member.key as AstNode) : '';

          if (!memberName || member.type !== 'TSPropertySignature') continue;

          const annotation = typeAnnotationOf(member);

          if (!annotation) continue;

          hash[memberName] = {
            ...blockParamFromTypeNode(memberName, annotation, ctx),
            description: descriptionFor(ctx.bundle, member)
          };
        }

        if (Object.keys(hash).length > 0) params.push(hash);
      } else {
        params.push(blockParamFromTypeNode(`param${params.length}`, element, ctx));
      }
    }

    return params;
  }

  // Object-style blocks (`Blocks: { content: { item: … } }`)
  if (typeNode.type === 'TSTypeLiteral') {
    for (const member of (typeNode.members ?? []) as AstNode[]) {
      const memberName = member.key ? nameText(member.key as AstNode) : '';

      if (!memberName || member.type !== 'TSPropertySignature') continue;

      const annotation = typeAnnotationOf(member);

      if (!annotation) continue;

      params.push({
        ...blockParamFromTypeNode(memberName, annotation, ctx),
        description: descriptionFor(ctx.bundle, member)
      });
    }
  }

  return params;
}

// ── Signature parsing ──────────────────────────────────────────

function parseSignature(
  signatureNode: AstNode,
  bundle: Bundle,
  scope: Scope
): ComponentSignature {
  const ctx: EvalContext = { scope, bundle, depth: 0, substitutions: new Map() };
  const sigMembers = evalContainer(signatureNode, ctx);
  const byName = new Map(sigMembers.map((member) => [member.name, member]));

  const result: ComponentSignature = {
    args: {},
    blocks: {},
    element: undefined,
    style: { customProperties: {}, parts: {} }
  };

  const argsMember = byName.get('Args');

  if (argsMember?.typeNode) {
    for (const member of evalContainer(argsMember.typeNode, step(ctx))) {
      result.args[member.name] = buildArgInfo(member, scope);
    }
  }

  const blocksMember = byName.get('Blocks');

  if (blocksMember) {
    // Prefer the declared tuple/object structure over resolved references
    const declared =
      blocksMember.anchor?.type === 'TSPropertySignature'
        ? typeAnnotationOf(blocksMember.anchor)
        : undefined;

    result.blocks = parseBlocks(declared ?? blocksMember.typeNode, ctx);
  }

  const elementMember = byName.get('Element');

  if (elementMember?.typeNode) {
    result.element = sliceText(elementMember.sourceBundle, elementMember.typeNode);
  }

  const styleMember = byName.get('Style');

  if (styleMember?.typeNode) {
    const styleMembers = evalContainer(styleMember.typeNode, step(ctx));

    for (const section of ['CustomProperties', 'Parts']) {
      const sectionMember = styleMembers.find((m) => m.name === section);

      if (!sectionMember) continue;

      const target = section === 'Parts' ? result.style.parts : result.style.customProperties;

      for (const prop of evalContainer(sectionMember.typeNode, { scope, bundle, depth: 2, substitutions: new Map() })) {
        const literal = (prop.typeNode as AstNode | undefined)?.literal as
          | AstNode
          | undefined;

        target[prop.name] =
          typeof literal?.value === 'string'
            ? literal.value
            : descriptionFor(prop.sourceBundle, prop.anchor);
      }
    }
  }

  return result;
}

function parseBlocks(
  typeNode: AstNode | undefined,
  ctx: EvalContext
): Record<string, BlockInfo> {
  const blocks: Record<string, BlockInfo> = {};

  if (!typeNode) return blocks;

  for (const member of evalContainer(typeNode, step(ctx))) {
    // Prefer the declared tuple/object structure over resolved references
    const declared =
      member.anchor?.type === 'TSPropertySignature'
        ? typeAnnotationOf(member.anchor)
        : member.typeNode;

    blocks[member.name] = {
      params: declared ? parseBlockParams(declared, ctx) : [],
      description: descriptionFor(member.sourceBundle ?? ctx.bundle, member.anchor)
    };
  }

  return blocks;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Extract component signatures purely from declaration files — no
 * TypeScript compiler involved at extraction time.
 *
 * The bundles must be keyed by module id (`app/button.gts`) relative to
 * the project, matching what {@link parseDeclarations} produces.
 */
export function analyzeDeclarations(
  bundles: Record<string, string>
): ComponentSignatureMap {
  const scope: Scope = { bundles: new Map() };

  candidateBundles.clear();

  for (const id of Object.keys(bundles)) {
    candidateBundles.add(id);
  }

  for (const [id, code] of Object.entries(bundles)) {
    scope.bundles.set(id, loadBundle(id, code));
  }

  const signatures: ComponentSignatureMap = {};

  for (const bundle of scope.bundles.values()) {
    for (const component of discoverComponents(scope, bundle)) {
      signatures[bundle.id] ??= {};
      signatures[bundle.id][component.name] = parseSignature(
        component.signatureNode,
        bundle,
        scope
      );
    }
  }

  return signatures;
}

