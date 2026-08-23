import path from 'node:path';

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

// ── Constants ──────────────────────────────────────────────────

/** Type wrappers around block-param components that carry bound-args info. */
const BOUND_ARGS_WRAPPER = 'WithBoundArgs';

/** TypeScript lib globals — ambient, matched by name (no import exists). */
const LIB_WRAPPERS = new Set(['Omit', 'Pick']);

interface ExtractContext {
  checker: TS.TypeChecker;
  /** tsconfig directory — anchor for relative output paths */
  base: string;
  /** Absolute declaration files the known component modules resolve to */
  knownModules: Record<'templateOnly' | 'glint' | 'component', string | undefined>;
}

// ── Program setup ──────────────────────────────────────────────

function isEmberTemplate(file: string): boolean {
  return file.endsWith('.gts') || file.endsWith('.gjs');
}

function normalizeReflectionPath(fileName: string): string {
  return fileName.replace(/\.(gts|gjs)\.ts$/, '.$1');
}

function relativeKey(ctx: ExtractContext, fileName: string): string {
  const abs = normalizeReflectionPath(fileName);
  const rel = path.isAbsolute(abs) ? path.relative(ctx.base, abs) : abs;

  return rel.split(path.sep).join('/');
}

function readCompilerOptions(
  opts?: DocgenOptions
): ReturnType<typeof ts.getParsedCommandLineOfConfigFile> {
  const file = resolveTsconfigFile(opts);

  if (!file) return undefined;

  return ts.getParsedCommandLineOfConfigFile(file, {}, ts.sys as never);
}

function createProgram(files: string[], opts?: DocgenOptions) {
  const commandLine = readCompilerOptions(opts);

  if (!commandLine) return undefined;

  const options = commandLine.options;
  const host = createDocgenHost(ts.createCompilerHost(options, /* setParentNodes */ true), ts);

  const rootNames = files.map((file) => (isEmberTemplate(file) ? `${file}.ts` : file));

  return ts.createProgram({ rootNames, options, host });
}

// ── Origin tracing ─────────────────────────────────────────────

type ModuleFamily = 'templateOnly' | 'glint' | 'component';

/**
 * Resolve the known component modules once per run, relative to one of the
 * entry files. Yields the absolute declaration file each specifier
 * resolves to (used for origin checks on canonical symbols).
 */
function resolveKnownModules(
  program: TS.Program,
  anchorFile: string
): ExtractContext['knownModules'] {
  const options = program.getCompilerOptions();
  const host = {
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories
  };

  const resolve = (specifier: string): string | undefined =>
    ts.resolveModuleName(specifier, anchorFile, options, host).resolvedModule?.resolvedFileName;

  return {
    templateOnly: resolve(TEMPLATE_ONLY_MODULE),
    glint: resolve(GLINT_TEMPLATE_MODULE),
    component: resolve(COMPONENT_MODULE)
  };
}

/** Follow alias symbols until the canonical declaration symbol. */
function canonicalSymbol(symbol: TS.Symbol | undefined, checker: TS.TypeChecker) {
  let current = symbol;
  const visited = new Set<TS.Symbol>();

  for (;;) {
    if (!current || visited.has(current)) return current;

    visited.add(current);

    if ((current.flags & ts.SymbolFlags.Alias) === 0) return current;

    const aliased = checker.getAliasedSymbol(current);

    if (aliased === current) return aliased;

    current = aliased;
  }
}

function inSameDirectory(file: string | undefined, resolvedModule: string | undefined): boolean {
  if (!file || !resolvedModule) return false;

  return path.dirname(path.resolve(file)) === path.dirname(path.resolve(resolvedModule));
}

/**
 * Which known module family a canonical symbol originates from — verified
 * by its declaration's source file against the resolved module paths and
 * by its canonical export name.
 */
function originFamily(symbol: TS.Symbol | undefined, ctx: ExtractContext): ModuleFamily | undefined {
  const canonical = canonicalSymbol(symbol, ctx.checker);

  if (!canonical) return undefined;

  const exportedName = String(canonical.escapedName ?? canonical.name ?? '');

  for (const declaration of canonical.getDeclarations() ?? []) {
    const file = declaration.getSourceFile()?.fileName;

    if (
      inSameDirectory(file, ctx.knownModules.templateOnly) &&
      SIGNATURE_WRAPPER_EXPORTS.includes(exportedName)
    ) {
      return 'templateOnly';
    }

    if (
      inSameDirectory(file, ctx.knownModules.glint) &&
      GLINT_WRAPPER_EXPORTS.includes(exportedName)
    ) {
      return 'glint';
    }

    if (
      inSameDirectory(file, ctx.knownModules.component) &&
      (exportedName === COMPONENT_BASE_NAME || exportedName === 'default')
    ) {
      return 'component';
    }
  }

  return undefined;
}

function isSignatureWrapperSymbol(symbol: TS.Symbol | undefined, ctx: ExtractContext): boolean {
  const family = originFamily(symbol, ctx);

  return family === 'templateOnly' || family === 'glint';
}

/** All wrapper type-reference nodes of a variable declarator. */
function wrapperReferenceNodes(declaration: TS.VariableDeclaration): TS.TypeReferenceNode[] {
  const nodes: TS.TypeReferenceNode[] = [];

  const annotation = declaration.type;

  if (annotation && ts.isTypeReferenceNode(annotation)) {
    nodes.push(annotation);
  }

  let current = declaration.initializer;

  while (current && ts.isAsExpression(current)) {
    if (ts.isTypeReferenceNode(current.type)) {
      nodes.push(current.type);
    }

    current = current.expression;
  }

  return nodes;
}


// ── Symbol helpers ─────────────────────────────────────────────

/** Documentation summary text of a symbol. */
function symbolDescription(symbol: TS.Symbol, ctx: ExtractContext): string {
  return symbol
    .getDocumentationComment(ctx.checker)
    .filter((part) => part.kind === 'text')
    .map((part) => part.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Value of a `@default` / `@defaultValue` JSDoc tag. */
function symbolDefaultValue(symbol: TS.Symbol): string | undefined {
  for (const tag of symbol.getJsDocTags()) {
    if (tag.name === 'default' || tag.name === 'defaultValue') {
      return (tag.text ?? []).map((part) => part.text).join('').trim();
    }
  }

  return undefined;
}

function literalValue(type: TS.Type): string | undefined {
  if ((type.flags & ts.TypeFlags.Literal) !== 0) {
    return String((type as TS.LiteralType).value);
  }

  return undefined;
}

function isStringLiteralUnion(type: TS.Type): string[] | undefined {
  if ((type.flags & ts.TypeFlags.Union) === 0) return undefined;

  const values: string[] = [];

  for (const constituent of (type as TS.UnionType).types) {
    if ((constituent.flags & ts.TypeFlags.StringLiteral) === 0) return undefined;

    values.push(String((constituent as TS.LiteralType).value));
  }

  return values.length > 0 ? values : undefined;
}

function isCallable(type: TS.Type): boolean {
  return type.getCallSignatures().length > 0;
}

function isTuple(type: TS.Type): boolean {
  return (
    (type.flags & ts.TypeFlags.Object) !== 0 &&
    ((type as TS.ObjectType).objectFlags & ts.ObjectFlags.Tuple) !== 0
  );
}

function isArray(type: TS.Type): boolean {
  if (
    (type.flags & ts.TypeFlags.Object) === 0 ||
    ((type as TS.ObjectType).objectFlags & ts.ObjectFlags.Reference) === 0
  ) {
    return false;
  }

  const target = (type as TS.TypeReference).target?.symbol;

  return String(target?.escapedName ?? target?.name ?? '') === 'Array';
}

// ── Arg-type serialization ─────────────────────────────────────

const STRUCTURAL_OBJECT_FLAGS =
  ts.ObjectFlags.Class |
  ts.ObjectFlags.Interface |
  ts.ObjectFlags.Anonymous |
  ts.ObjectFlags.Mapped |
  ts.ObjectFlags.Reference;

function buildArgTypeInfo(input: TS.Type, ctx: ExtractContext, depth = 0): ArgTypeInfo {
  // Optional members carry `| undefined` — classify the underlying type
  let type = input;

  if (
    (type.flags & ts.TypeFlags.Union) !== 0 &&
    ((type as TS.UnionType).types.some((t) => (t.flags & ts.TypeFlags.Undefined) !== 0) ||
      (type as TS.UnionType).types.some((t) => (t.flags & ts.TypeFlags.Null) !== 0))
  ) {
    const stripped = ctx.checker.getNonNullableType(type);

    if (stripped !== type) {
      type = stripped;
    }
  }

  const raw = ctx.checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);

  if ((type.flags & ts.TypeFlags.StringLike) !== 0) {
    return { category: 'string', raw };
  }

  if ((type.flags & ts.TypeFlags.NumberLike) !== 0) {
    return { category: 'number', raw };
  }

  if ((type.flags & ts.TypeFlags.BooleanLike) !== 0) {
    return { category: 'boolean', raw };
  }

  const literals = isStringLiteralUnion(type);

  if (literals) {
    return { category: 'enum', raw, options: literals };
  }

  if (isCallable(type)) {
    return { category: 'function', raw };
  }

  if (isTuple(type)) {
    return { category: 'array', raw, elementType: { category: 'other', raw } };
  }

  if (isArray(type)) {
    const elementType = (type as TS.TypeReference).typeArguments?.[0];

    return {
      category: 'array',
      raw,
      elementType: elementType
        ? buildArgTypeInfo(elementType, ctx, depth + 1)
        : { category: 'other', raw: 'unknown' }
    };
  }

  if (
    depth < 3 &&
    (type.flags & ts.TypeFlags.Object) !== 0 &&
    ((type as TS.ObjectType).objectFlags & STRUCTURAL_OBJECT_FLAGS) !== 0
  ) {
    const properties: Record<string, ArgTypeInfo> = {};

    for (const prop of ctx.checker.getPropertiesOfType(type)) {
      if ((prop.flags & ts.SymbolFlags.Method) !== 0) continue;

      const declaration = prop.declarations?.[0];

      if (!declaration) continue;

      properties[prop.name] = buildArgTypeInfo(
        ctx.checker.getTypeOfSymbolAtLocation(prop, declaration),
        ctx,
        depth + 1
      );
    }

    if (Object.keys(properties).length > 0) {
      return { category: 'object', raw, properties };
    }
  }

  return { category: 'other', raw };
}

function symbolType(symbol: TS.Symbol, ctx: ExtractContext): TS.Type | undefined {
  const location =
    symbol.declarations?.[0] ?? ({ kind: ts.SyntaxKind.SourceFile } as unknown as TS.Node);

  return ctx.checker.getTypeOfSymbolAtLocation(symbol, location);
}

function buildArgInfo(prop: TS.Symbol, ctx: ExtractContext): ArgInfo {
  const type = symbolType(prop, ctx);

  return {
    type: type ? buildArgTypeInfo(type, ctx) : { category: 'other', raw: 'unknown' },
    required: (prop.flags & ts.SymbolFlags.Optional) === 0,
    description: symbolDescription(prop, ctx),
    defaultValue: symbolDefaultValue(prop)
  };
}

// ── Block params ───────────────────────────────────────────────

function extractStringLiterals(node: TS.TypeNode): string[] {
  if (ts.isLiteralTypeNode(node)) {
    const literal = node.literal;

    if (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal)) {
      return [literal.text];
    }

    return [];
  }

  if (ts.isUnionTypeNode(node)) {
    return node.types.flatMap((t) => extractStringLiterals(t));
  }

  return [];
}

/** Export name under which `declaration` is visible in its own source file. */
function exportNameForDeclaration(
  sourceFile: TS.SourceFile,
  declaration: TS.Declaration,
  ctx: ExtractContext
): string | undefined {
  const moduleSymbol = ctx.checker.getSymbolAtLocation(sourceFile);

  if (!moduleSymbol) return undefined;

  for (const exported of ctx.checker.getExportsOfModule(moduleSymbol)) {
    for (const exportedDeclaration of exported.getDeclarations() ?? []) {
      if (exportedDeclaration === declaration) {
        return exported.name === 'default' ? Default : exported.name;
      }
    }
  }

  return undefined;
}

/**
 * Resolve a name node referencing a component to its source file and
 * export name, following export aliases (`typeof X` where X is imported).
 */
function resolveComponentNode(
  node: TS.Node,
  ctx: ExtractContext
): { filePath: string; exportName: string } | undefined {
  const symbol = ctx.checker.getSymbolAtLocation(node);
  const resolved =
    symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0
      ? ctx.checker.getAliasedSymbol(symbol)
      : symbol;

  const declaration = resolved?.declarations?.find(
    (d) => ts.isClassDeclaration(d) || ts.isVariableDeclaration(d)
  );

  if (!declaration) return undefined;

  const declarationFile = declaration.getSourceFile();
  const filePath = relativeKey(ctx, declarationFile.fileName);
  const exportName = exportNameForDeclaration(declarationFile, declaration, ctx);

  if (!exportName) return undefined;

  return { filePath, exportName };
}

/**
 * Detect component references in a block-param type node, including
 * wrappers like `WithBoundArgs<typeof X, 'a' | 'b'>` — reading the
 * declared type so the wrapper identity survives.
 */
function componentRefFromTypeNode(
  node: TS.TypeNode | undefined,
  ctx: ExtractContext
): BlockParam['componentRef'] | undefined {
  if (!node) return undefined;

  if (ts.isParenthesizedTypeNode(node)) {
    return componentRefFromTypeNode(node.type, ctx);
  }

  if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
    for (const t of node.types) {
      const inner = componentRefFromTypeNode(t, ctx);

      if (inner) return inner;
    }

    return undefined;
  }

  if (ts.isTypeQueryNode(node)) {
    return resolveComponentNode(node.exprName, ctx);
  }

  if (ts.isTypeReferenceNode(node)) {
    const args = node.typeArguments ?? [];

    // `WithBoundArgs<typeof X, 'keys'>` — verified against `@glint/template`
    // by import origin (renames transparent). The modifier keeps the
    // canonical export name.
    const boundArgsSymbol = canonicalSymbol(
      ctx.checker.getSymbolAtLocation(node.typeName),
      ctx.checker
    );
    const boundArgsName = String(boundArgsSymbol?.escapedName ?? '');

    if (
      boundArgsName === BOUND_ARGS_WRAPPER &&
      originFamily(ctx.checker.getSymbolAtLocation(node.typeName), ctx) === 'glint' &&
      args.length > 0
    ) {
      for (const arg of args) {
        const inner = componentRefFromTypeNode(arg, ctx);

        if (inner) {
          const typeArgs = args
            .filter((other) => other !== arg)
            .flatMap((other) => extractStringLiterals(other));

          return { ...inner, modifiers: [{ name: BOUND_ARGS_WRAPPER, typeArgs }] };
        }
      }

      return undefined;
    }

    return resolveComponentNode(node.typeName, ctx);
  }

  return undefined;
}

/** Documentation text attached directly to a syntax node (e.g. tuple members). */
function nodeDescription(node: TS.Node): string {
  const jsDoc = ts.getJSDocCommentsAndTags(node)
    .filter((n): n is TS.JSDoc => ts.isJSDoc(n))
    .map((n) => (typeof n.comment === 'string' ? n.comment : ''))
    .join(' ');

  return jsDoc.replace(/\s+/g, ' ').trim();
}

function blockParamFromNode(name: string, node: TS.TypeNode, ctx: ExtractContext): BlockParam {
  return {
    name,
    type: ctx.checker.typeToString(ctx.checker.getTypeAtLocation(node)),
    description: '',
    componentRef: componentRefFromTypeNode(node, ctx)
  };
}

/** Params of a single block, derived from its declared tuple/object shape. */
function parseBlockParams(typeNode: TS.TypeNode, ctx: ExtractContext): BlockInfo['params'] {
  const params: BlockInfo['params'] = [];

  if (ts.isTupleTypeNode(typeNode)) {
    for (const element of typeNode.elements) {
      if (ts.isNamedTupleMember(element)) {
        params.push({
          name: element.name.getText(),
          type: ctx.checker.typeToString(ctx.checker.getTypeAtLocation(element.type)),
          description: nodeDescription(element),
          componentRef: componentRefFromTypeNode(element.type, ctx)
        });
      } else if (ts.isTypeLiteralNode(element)) {
        // Yield hash: one entry per named member
        const hash: HashBlockParam = {};

        for (const member of element.members) {
          if (!member.name || !ts.isPropertySignature(member)) continue;

          const innerType = member.type;

          if (!innerType) continue;

          const symbol = ctx.checker.getSymbolAtLocation(member.name);

          hash[member.name.getText()] = {
            ...blockParamFromNode(member.name.getText(), innerType, ctx),
            description:
              symbol && symbolDescription(symbol, ctx)
                ? symbolDescription(symbol, ctx)
                : nodeDescription(member)
          };
        }

        if (Object.keys(hash).length > 0) params.push(hash);
      } else {
        params.push(blockParamFromNode(`param${params.length}`, element, ctx));
      }
    }

    return params;
  }

  // Object-style blocks (`Blocks: { content: { item: …; visible: boolean } }`)
  if (ts.isTypeLiteralNode(typeNode)) {
    for (const member of typeNode.members) {
      if (!member.name || !ts.isPropertySignature(member) || !member.type) continue;

      const symbol = ctx.checker.getSymbolAtLocation(member.name);

      params.push({
        ...blockParamFromNode(member.name.getText(), member.type, ctx),
        description: symbol ? symbolDescription(symbol, ctx) : ''
      });
    }
  }

  return params;
}

function parseBlocks(blocksType: TS.Type, ctx: ExtractContext): Record<string, BlockInfo> {
  const blocks: Record<string, BlockInfo> = {};

  for (const prop of ctx.checker.getPropertiesOfType(blocksType)) {
    // Read the declared type so tuple/yield-hash structure survives
    const declaration = prop.declarations?.[0];
    const declaredType =
      declaration && ts.isPropertySignature(declaration) ? declaration.type : undefined;

    blocks[prop.name] = {
      params: declaredType ? parseBlockParams(declaredType, ctx) : [],
      description: symbolDescription(prop, ctx)
    };
  }

  return blocks;
}

// ── Signature extraction ───────────────────────────────────────

function propertyType(
  type: TS.Type,
  name: string,
  ctx: ExtractContext
): TS.Type | undefined {
  const prop = ctx.checker.getPropertyOfType(type, name);

  return prop ? symbolType(prop, ctx) : undefined;
}

function parseStyle(
  styleType: TS.Type,
  ctx: ExtractContext
): { customProperties: Record<string, string>; parts: Record<string, string> } {
  const style = { customProperties: {}, parts: {} } as {
    customProperties: Record<string, string>;
    parts: Record<string, string>;
  };

  for (const section of ['CustomProperties', 'Parts'] as const) {
    const key = section === 'Parts' ? 'parts' : 'customProperties';
    const sectionType = propertyType(styleType, section, ctx);

    if (!sectionType) continue;

    for (const prop of ctx.checker.getPropertiesOfType(sectionType)) {
      const value =
        literalValue(symbolType(prop, ctx) ?? ({} as TS.Type)) || symbolDescription(prop, ctx);

      style[key][prop.name] = value;
    }
  }

  return style;
}

function parseSignature(signatureType: TS.Type, ctx: ExtractContext): ComponentSignature {
  const args: Record<string, ArgInfo> = {};
  const argsType = propertyType(signatureType, 'Args', ctx);

  if (argsType) {
    for (const prop of ctx.checker.getPropertiesOfType(argsType)) {
      args[prop.name] = buildArgInfo(prop, ctx);
    }
  }

  let blocks: Record<string, BlockInfo> = {};
  const blocksType = propertyType(signatureType, 'Blocks', ctx);

  if (blocksType) {
    blocks = parseBlocks(blocksType, ctx);
  }

  const elementType = propertyType(signatureType, 'Element', ctx);
  const styleType = propertyType(signatureType, 'Style', ctx);

  return {
    args,
    blocks,
    element: elementType ? ctx.checker.typeToString(elementType) : undefined,
    style: styleType ? parseStyle(styleType, ctx) : { customProperties: {}, parts: {} }
  };
}

/**
 * The signature type argument referenced by a wrapper like `TOC<S>` —
 * only when the wrapper's canonical origin is a known component module.
 */
function unwrapSignatureWrapper(
  type: TS.Type | undefined,
  ctx: ExtractContext
): TS.Type | undefined {
  if (!type) return undefined;

  // Type aliases (`type TOC<T> = …`) keep their identity + arguments here,
  // regardless of how the alias body resolves (intersection, mapped, …)
  if (originFamily(type.aliasSymbol, ctx) === 'templateOnly') {
    return type.aliasTypeArguments?.[0];
  }

  // Generic interfaces/classes (`TemplateOnlyComponent<S>`, `ComponentLike<S>`)
  if (
    (type.flags & ts.TypeFlags.Object) === 0 ||
    ((type as TS.ObjectType).objectFlags & ts.ObjectFlags.Reference) === 0
  ) {
    return undefined;
  }

  const reference = type as TS.TypeReference;
  const family = originFamily(reference.target?.symbol, ctx);

  if (family === 'templateOnly' || family === 'glint') {
    return reference.aliasTypeArguments?.[0] ?? reference.typeArguments?.[0];
  }

  return undefined;
}

/** The signature type of a component-like export, when it has one. */
function signatureTypeOfExport(
  symbol: TS.Symbol,
  ctx: ExtractContext
): TS.Type | undefined {
  for (const declaration of symbol.getDeclarations() ?? []) {
    // Class extending `Component<Signature>` — verified against
    // `@glimmer/component` by import origin.
    if (ts.isClassDeclaration(declaration)) {
      const heritage = declaration.heritageClauses?.find(
        (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword
      );

      for (const heritageType of heritage?.types ?? []) {
        const isComponent =
          originFamily(ctx.checker.getSymbolAtLocation(heritageType.expression), ctx) ===
          'component';

        if (!isComponent) continue;

        const arg = heritageType.typeArguments?.[0];

        if (arg) return ctx.checker.getTypeAtLocation(arg);
      }
    }

    // Variable typed as `TOC<Signature>` / inline `TOC<{ … }>` — either via
    // an explicit annotation or an `as` cast (resolved by the checker).
    if (ts.isVariableDeclaration(declaration)) {
      // Syntactic wrapper references — verified against their import origin
      for (const refNode of wrapperReferenceNodes(declaration)) {
        if (!isSignatureWrapperSymbol(ctx.checker.getSymbolAtLocation(refNode.typeName), ctx)) {
          continue;
        }

        const arg = refNode.typeArguments?.[0];

        if (arg) return ctx.checker.getTypeAtLocation(arg);
      }

      const declared = unwrapSignatureWrapper(
        ctx.checker.getTypeOfSymbolAtLocation(symbol, declaration),
        ctx
      );

      if (declared) return declared;
    }
  }

  return undefined;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Extract component signatures by executing the TypeScript type system:
 * the signature types are resolved through a real compiler program, so
 * composed, mapped, conditional and handcrafted types all yield their
 * fully evaluated members — no shape heuristics involved.
 */
export async function parseSignatures(
  files: string[],
  opts?: DocgenOptions
): Promise<ComponentSignatureMap> {
  if (files.length === 0) return {};

  const base = resolveTsconfigFile(opts) ? path.dirname(resolveTsconfigFile(opts)!) : undefined;

  const program = createProgram(files, opts);

  if (!program || !base) return {};

  const checker = program.getTypeChecker();
  const anchor = program.getSourceFile(files[0] && (isEmberTemplate(files[0]) ? `${files[0]}.ts` : files[0]))?.fileName
    ?? path.resolve(base, files[0]);
  const ctx: ExtractContext = {
    checker,
    base,
    knownModules: resolveKnownModules(program, anchor)
  };
  const signatures: ComponentSignatureMap = {};

  for (const file of files) {
    // Undo the virtual `.gts.ts` naming added for the ember compiler host
    const rootName = isEmberTemplate(file) ? `${file}.ts` : file;
    const sourceFile = program.getSourceFile(rootName);

    if (!sourceFile) continue;

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);

    if (!moduleSymbol) continue;

    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const signatureType = signatureTypeOfExport(exported, ctx);

      if (!signatureType) continue;

      const key = relativeKey(ctx, sourceFile.fileName);
      const name =
        (exported.flags & ts.SymbolFlags.Alias) !== 0
          ? (checker.getAliasedSymbol(exported).name)
          : exported.name;

      signatures[key] ??= {};
      signatures[key][name === 'default' ? Default : name] = parseSignature(signatureType, ctx);
    }
  }

  return signatures;
}
