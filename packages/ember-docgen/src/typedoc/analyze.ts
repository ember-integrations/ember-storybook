import { existsSync } from 'node:fs';
import path from 'node:path';

/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * JSONOutput types are strict discriminated unions, but the data comes
 * from deserialized JSON at runtime so every property is nullable. */
import { ReflectionKind } from 'typedoc';

import { extractBlockParamModifiers, extractTypeMembers } from './ast';

import { unwrapBlockParams } from '../block-params';
import {
  COMPONENT_BASE_NAME,
  COMPONENT_MODULE,
  GLINT_TEMPLATE_MODULE,
  GLINT_WRAPPER_EXPORTS,
  SIGNATURE_WRAPPER_EXPORTS,
  TEMPLATE_ONLY_MODULE
} from '../modules';
import { resolveTsconfigBase } from '../config';
import { Default } from '../signature';

import type { ExternalTypeMember } from './ast';
import type {
  ArgInfo,
  ArgTypeCategory,
  ArgTypeInfo,
  BlockInfo,
  BlockParam,
  ComponentSignature,
  ComponentSignatureMap,
  DocgenOptions,
  HashBlockParam
} from '../signature';
import type { JSONOutput } from 'typedoc';

// ── Types ──────────────────────────────────────────────────────

interface ParsedSignature {
  sig: ComponentSignature;
  name: string;
  file: string | undefined;
}

type ComponentRef = {
  filePath: string;
  exportName: string;
  importPath?: string;
  modifiers?: { name: string; typeArgs: string[] }[];
};

type TypeDocReflection = JSONOutput.DeclarationReflection;
type TypeDocType = JSONOutput.SomeType;

// ── Primitive helpers ──────────────────────────────────────────

function isPropertySignature(reflection: TypeDocReflection): boolean {
  return reflection.kind === ReflectionKind.Property;
}

function isOptional(reflection: TypeDocReflection): boolean {
  return reflection.flags?.isOptional ?? false;
}

function sourceFile(reflection: TypeDocReflection): string | undefined {
  return reflection.sources?.[0]?.fileName;
}

function extractSummaryText(comment: JSONOutput.Comment | undefined): string {
  if (!comment?.summary) return '';

  return comment.summary
    .filter((p) => p.kind === 'text')
    .map((p) => p.text)
    .join(' ');
}

function extractDefaultValue(reflection: TypeDocReflection): string | undefined {
  const defaultValueTag = reflection.comment?.blockTags?.find(
    (t) => t.tag === '@default' || t.tag === '@defaultValue'
  );

  if (defaultValueTag) {
    const raw = defaultValueTag.content.map((c) => c.text).join(' ');

    return raw
      .replace(/^```\w*\s*/, '')
      .replace(/```$/, '')
      .trim();
  }

  return undefined;
}

function extractStringLiteralValue(reflection: TypeDocReflection): string | undefined {
  if (reflection.type?.type === 'literal' && typeof reflection.type.value === 'string') {
    return reflection.type.value;
  }

  return undefined;
}

function extractTypeReflection(reflection: TypeDocReflection): TypeDocReflection | undefined {
  if (reflection.type?.type === 'reflection' && reflection.type.declaration) {
    return reflection.type.declaration;
  }

  return undefined;
}

function extractLiteralStrings(type: TypeDocType): string[] {
  if (type.type === 'literal' && typeof type.value === 'string') return [type.value];
  if (type.type === 'union') return (type.types ?? []).flatMap((t) => extractLiteralStrings(t));

  return [];
}

/**
 * Reference wrappers that don't change the shape of their type argument, so
 * member extraction can look straight through them.
 */
const TRANSPARENT_WRAPPERS = new Set(['Simplify', 'Readonly', 'Partial', 'Required']);

type ResolveContext = {
  idToReflection: Map<number, TypeDocReflection>;
  idToPath: Map<number, { filePath: string; name: string }>;
  /** tsconfig directory — enables re-reading sources for external references */
  base?: string;
};

/** A reference TypeDoc could not resolve to a reflection in this JSON. */
interface ExternalReference {
  packagePath: string;
  qualifiedName: string;
  /** Keys excluded by an enclosing `Omit<T, K>` */
  omit: string[];
  /** Keys allowed by an enclosing `Pick<T, K>` (empty = all) */
  pick: string[];
}

function resolvedReflection(
  id: number,
  ctx: ResolveContext
): TypeDocReflection | undefined {
  const reflection = ctx.idToReflection.get(id);

  if (!reflection || reflection.variant === 'reference') return undefined;

  return reflection;
}

/** Members of an interface/type reflection including inherited ones. */
function reflectionMembers(
  reflection: TypeDocReflection,
  ctx: ResolveContext
): TypeDocReflection[] {
  const own = reflection.children ?? [];
  const inherited = (reflection.extendedTypes ?? []).flatMap((ext) =>
    resolveMembers(ext, ctx)
  );

  const members = new Map<string, TypeDocReflection>();

  for (const member of [...inherited, ...own]) {
    members.set(member.name, member);
  }

  return [...members.values()];
}

/**
 * Resolve a "member container" type (the value of `Args`, `Blocks`, `Style`,
 * …) into its property/method reflections. Follows references to interfaces,
 * flattens intersections/unions and unwraps utility wrappers (`Simplify`,
 * `Omit`, `Pick`, …) so composed signatures yield their full member list.
 */
function resolveMembers(
  type: TypeDocType | undefined,
  ctx: ResolveContext
): TypeDocReflection[] {
  if (!type) return [];

  switch (type.type) {
    case 'reflection': {
      return type.declaration?.children ?? [];
    }

    case 'intersection':
    case 'union': {
      return (type.types ?? []).flatMap((t) => resolveMembers(t, ctx));
    }

    case 'reference': {
      const name = type.name ?? '';
      const args = type.typeArguments ?? [];

      // Omit<T, K> / Pick<T, K> — filter the members of T by literal keys
      if ((name === 'Omit' || name === 'Pick') && args.length >= 2) {
        const keys = new Set(extractLiteralStrings(args[1]));
        const members = resolveMembers(args[0], ctx);

        return members.filter((member) =>
          name === 'Omit' ? !keys.has(member.name) : keys.has(member.name)
        );
      }

      // Reference to a reflection within this project (interface, type…)
      if (typeof type.target === 'number') {
        const target = resolvedReflection(type.target, ctx);

        return target ? reflectionMembers(target, ctx) : [];
      }

      // Transparent wrapper — look through to the wrapped type
      if (TRANSPARENT_WRAPPERS.has(name) && args.length > 0) {
        return resolveMembers(args[0], ctx);
      }

      return [];
    }

    default: {
      return [];
    }
  }
}

/** Members of a signature property, resolving composed types when possible. */
function memberReflections(
  prop: TypeDocReflection,
  ctx: ResolveContext
): TypeDocReflection[] {
  if (prop.type) {
    const resolved = resolveMembers(prop.type, ctx);

    if (resolved.length > 0 || !prop.children) return resolved;
  }

  return prop.children ?? [];
}

/** Collect references that could not be resolved within the JSON. */
function collectExternalReferences(
  type: TypeDocType | undefined,
  ctx: ResolveContext,
  found: ExternalReference[] = [],
  omit: string[] = [],
  pick: string[] = []
): ExternalReference[] {
  if (!type) return found;

  switch (type.type) {
    case 'reference': {
      const name = type.name ?? '';
      const args = type.typeArguments ?? [];

      if ((name === 'Omit' || name === 'Pick') && args.length >= 2) {
        const keys = extractLiteralStrings(args[1]);

        collectExternalReferences(
          args[0],
          ctx,
          found,
          name === 'Omit' ? [...omit, ...keys] : omit,
          name === 'Pick' ? [...(pick.length > 0 ? pick : keys)] : pick
        );
      } else if (typeof type.target === 'number') {
        // resolvable in-JSON reference
      } else if (TRANSPARENT_WRAPPERS.has(name) && args.length > 0) {
        collectExternalReferences(args[0], ctx, found, omit, pick);
      } else {
        const target = type.target as { packagePath?: string; qualifiedName?: string };

        if (target?.packagePath && target?.qualifiedName) {
          found.push({
            packagePath: target.packagePath,
            qualifiedName: target.qualifiedName,
            omit,
            pick
          });
        }
      }

      break;
    }

    case 'intersection':
    case 'union': {
      for (const t of type.types ?? []) {
        collectExternalReferences(t, ctx, found, omit, pick);
      }

      break;
    }
    // No default
  }

  return found;
}

function dedupeExternalReferences(refs: ExternalReference[]): ExternalReference[] {
  const seen = new Map<string, ExternalReference>();

  for (const ref of refs) {
    const key = `${ref.packagePath}::${ref.qualifiedName}`;
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, ref);

      continue;
    }

    // Merge filters across occurrences
    existing.omit = [...new Set([...existing.omit, ...ref.omit])];
    existing.pick =
      existing.pick.length > 0 && ref.pick.length > 0
        ? existing.pick.filter((key2) => ref.pick.includes(key2))
        : [...(existing.pick.length > 0 ? existing.pick : ref.pick)];
  }

  return [...seen.values()];
}

/**
 * Resolve external references (types living in files not part of the TypeDoc
 * JSON — e.g. helper interfaces imported from other project files) by reading
 * the source directly. Requires the tsconfig base directory.
 */
function resolveExternalMembers(
  type: TypeDocType | undefined,
  ctx: ResolveContext
): ExternalTypeMember[] {
  if (!ctx.base) return [];

  const refs = dedupeExternalReferences(collectExternalReferences(type, ctx));
  const members: ExternalTypeMember[] = [];

  for (const ref of refs) {
    // Skip third-party packages — only recover from project sources
    if (ref.packagePath.includes('node_modules')) continue;

    const filePath = path.isAbsolute(ref.packagePath)
      ? normalizeReflectionPath(ref.packagePath)
      : normalizeReflectionPath(path.resolve(ctx.base, ref.packagePath));

    if (!existsSync(filePath)) continue;

    const typeName = ref.qualifiedName.split('.').at(-1) ?? ref.qualifiedName;
    const omit = new Set(ref.omit);
    const pick = new Set(ref.pick);

    members.push(
      ...extractTypeMembers(filePath, typeName).filter(
        (member) =>
          !omit.has(member.name) && (pick.size === 0 || pick.has(member.name))
      )
    );
  }

  return members;
}

/** Map a raw type string to semantic arg-type info. */
function argTypeInfoFromString(raw: string): ArgTypeInfo {
  const trimmed = raw.trim();

  if (trimmed === 'string' || trimmed === 'number' || trimmed === 'boolean') {
    return { category: trimmed, raw: trimmed };
  }

  const literals = [...trimmed.matchAll(/'([^']*)'|"([^"]*)"/g)].map(
    (match) => match[1] ?? match[2]!
  );
  const withoutLiterals = trimmed.replace(/'[^']*'|"[^"]*"/g, '').trim();

  if (literals.length > 0 && /^(\s*\|\s*)?$/.test(withoutLiterals)) {
    return { category: 'enum', raw: trimmed, options: literals };
  }

  if (trimmed.startsWith('(') || trimmed.includes('=>')) {
    return { category: 'function', raw: trimmed };
  }

  return { category: 'other', raw: trimmed };
}

function derivePackageName(packagePath: string): string {
  const withoutNodeModules = packagePath.replace(/^node_modules\//, '');
  const parts = withoutNodeModules.split('/');

  // Scoped package: @scope/name
  if (parts[0]?.startsWith('@')) {
    return parts.slice(0, 2).join('/');
  }

  // Unscoped: package-name
  return parts[0] ?? withoutNodeModules;
}

// ── Reflection map ─────────────────────────────────────────────

function normalizeReflectionPath(fileName: string): string {
  return fileName.replace(/\.(gts|gjs)\.ts$/, '.$1');
}

function buildReflectionMaps(project: JSONOutput.ProjectReflection): {
  idToPath: Map<number, { filePath: string; name: string }>;
  idToReflection: Map<number, TypeDocReflection>;
} {
  const idToPath = new Map<number, { filePath: string; name: string }>();
  const idToReflection = new Map<number, TypeDocReflection>();

  function walk(reflection: TypeDocReflection | JSONOutput.ProjectReflection) {
    idToReflection.set(reflection.id, reflection as never);

    if ('sources' in reflection && reflection.sources?.[0]?.fileName) {
      idToPath.set(reflection.id, {
        filePath: normalizeReflectionPath(reflection.sources[0].fileName),
        name: reflection.name === 'default' ? Default : reflection.name
      });
    }

    for (const child of reflection.children ?? []) {
      walk(child);
    }
  }

  walk(project);

  return { idToPath, idToReflection };
}

function isEmberComponent(
  id: number,
  idToReflection: Map<number, TypeDocReflection>,
  parsed: Map<number, ParsedSignature>
): boolean {
  const reflection = idToReflection.get(id);

  if (!reflection) return false;
  if (reflection.variant === 'reference') return false;

  // Must be a class or variable
  if (reflection.kind !== ReflectionKind.Variable && reflection.kind !== ReflectionKind.Class) {
    return false;
  }

  // Class extends Component<Signature> — verified against
  // `@glimmer/component` by the serialized reference origin.
  if (reflection.kind === ReflectionKind.Class && reflection.extendedTypes) {
    for (const ext of reflection.extendedTypes) {
      if (isComponentBaseReference(ext)) return true;
    }
  }

  // Variable typed as TOC<Signature> / ComponentLike<S> / Invokable<...> —
  // verified against the serialized reference origin.
  if (
    reflection.kind === ReflectionKind.Variable &&
    isSignatureWrapperReference(reflection.type)
  ) {
    return true;
  }

  return false;
}

// ── Origin checks (serialized references) ──────────────────────

interface SerializedTarget {
  packageName?: string;
  packagePath?: string;
  qualifiedName?: string;
}

function referenceTarget(
  type: TypeDocType | undefined
): SerializedTarget | undefined {
  if (type?.type !== 'reference' || typeof type.target !== 'object') return undefined;

  return type.target as SerializedTarget;
}

/** Canonical export name of a serialized reference (`"pkg/path".TOC` → `TOC`). */
function canonicalExportName(target: SerializedTarget): string | undefined {
  const qualifiedName = target.qualifiedName;

  if (!qualifiedName) return undefined;

  const lastDot = qualifiedName.lastIndexOf('.');

  return lastDot === -1 ? qualifiedName : qualifiedName.slice(lastDot + 1);
}

/**
 * Whether a serialized reference points into a known module. The origin
 * may surface in any of the three serialized fields depending on how the
 * project was compiled (`packageName`, `packagePath`, `qualifiedName`).
 */
function fromModule(target: SerializedTarget, specifier: string): boolean {
  if (target.packageName === specifier) return true;

  // TypeDoc may split the specifier across packageName + packagePath
  // (e.g. packageName '@ember/component' + packagePath
  // 'template-only/index.d.ts'), and may nest pnpm store paths.
  const joined = `${target.packageName ?? ''}/${target.packagePath ?? ''}`;

  return (
    joined.includes(`${specifier}.d.ts`) ||
    joined.includes(`${specifier}/`) ||
    Boolean(target.qualifiedName?.startsWith(`"${specifier}".`))
  );
}

/**
 * Whether a serialized class-extends reference points at the classic
 * component base class (`@glimmer/component`). Numeric targets cannot
 * prove their origin and are rejected.
 */
function isComponentBaseReference(ext: TypeDocType | undefined): boolean {
  const target = referenceTarget(ext);

  if (!target || !fromModule(target, COMPONENT_MODULE)) return false;

  const exportedName = canonicalExportName(target);

  return exportedName === COMPONENT_BASE_NAME || exportedName === 'default';
}

/**
 * Whether a serialized variable-type reference is a known signature
 * wrapper (`TOC`, `TemplateOnlyComponent`, `ComponentLike`, `Invokable`),
 * verified by its origin package. Numeric targets cannot prove their
 * origin and are rejected.
 */
function isSignatureWrapperReference(type: TypeDocType | undefined): boolean {
  const target = referenceTarget(type);

  if (!target) return false;

  const exportedName = canonicalExportName(target);

  if (!exportedName) return false;

  if (fromModule(target, TEMPLATE_ONLY_MODULE) && SIGNATURE_WRAPPER_EXPORTS.includes(exportedName)) {
    return true;
  }

  return fromModule(target, GLINT_TEMPLATE_MODULE) && GLINT_WRAPPER_EXPORTS.includes(exportedName);
}

function resolveComponentRefDeep(
  type: TypeDocType | undefined,
  idToReflection: Map<number, TypeDocReflection>,
  idToPath: Map<number, { filePath: string; name: string }>,
  parsed: Map<number, ParsedSignature>
): ComponentRef | undefined {
  if (!type) return undefined;

  switch (type.type) {
    case 'reference': {
      // Numeric target — is it a known component?
      if (typeof type.target === 'number') {
        if (isEmberComponent(type.target, idToReflection, parsed)) {
          const resolved = idToPath.get(type.target);

          if (!resolved) return undefined;

          return {
            filePath: resolved.filePath,
            exportName: resolved.name
          };
        }

        return undefined;
      }

      // Object target — external package
      if (type.target && typeof type.target === 'object') {
        const { packageName, packagePath, qualifiedName } = type.target;

        // Skip known Glint utility types — they are base types that components
        // satisfy but are not components themselves. TypeDoc resolves typeof X
        // (where X extends Component) to Invokable, losing the original
        // reference. Verified by origin, not bare name.
        const GLINT_UTILITY_EXPORTS = [
          'Invokable',
          'TOC',
          'ComponentLike',
          'HelperLike',
          'ModifierLike'
        ];

        if (
          qualifiedName &&
          GLINT_UTILITY_EXPORTS.includes(canonicalExportName({ qualifiedName }) ?? '') &&
          fromModule(type.target as SerializedTarget, GLINT_TEMPLATE_MODULE) ||
          fromModule(type.target as SerializedTarget, TEMPLATE_ONLY_MODULE)
        ) {
          return undefined;
        }

        if (packagePath && qualifiedName) {
          return {
            filePath: packagePath,
            exportName: qualifiedName,
            importPath: packageName ?? derivePackageName(packagePath)
          };
        }
      }

      // Reference with typeArguments — walk inside wrappers
      if (type.typeArguments) {
        // We need to find which type argument leads to a component.
        // Try each; the first that resolves is the component, the rest are modifier metadata.
        for (const ta of type.typeArguments) {
          const inner = resolveComponentRefDeep(ta, idToReflection, idToPath, parsed);

          if (inner) {
            // Collect non-component type arguments as modifier metadata
            const nonComponentTypeArgs = type.typeArguments.flatMap((t) =>
              t === ta ? [] : extractLiteralStrings(t)
            );

            const m: { name: string; typeArgs: string[] } = {
              name: type.name ?? '',
              typeArgs: nonComponentTypeArgs
            };

            return {
              ...inner,
              modifiers: [...(inner.modifiers ?? []), m]
            };
          }
        }

        // No component found in any type argument. This happens when
        // TypeDoc resolves typeof ComponentX to a Glint utility type
        // (like Invokable) which we skip. The wrapper still has modifier
        // info (string literal type args). Return a marker ref — the
        // marker-resolution step completes it by matching param name to a
        // component in the same file.
        const modTypeArgs = type.typeArguments.flatMap((t) => extractLiteralStrings(t));

        if (modTypeArgs.length > 0 && type.name) {
          return {
            filePath: '',
            exportName: '',
            modifiers: [{ name: type.name, typeArgs: modTypeArgs }]
          };
        }
      }

      return undefined;
    }

    case 'query': {
      if (type.queryType) {
        // eslint-disable-next-line unicorn/no-useless-recursion
        return resolveComponentRefDeep(
          type.queryType,
          idToReflection,
          idToPath,
          parsed
        );
      }

      return undefined;
    }

    case 'union':
    case 'intersection': {
      for (const t of type.types ?? []) {
        const inner = resolveComponentRefDeep(t, idToReflection, idToPath, parsed);

        if (inner) return inner;
      }

      return undefined;
    }

    case 'conditional': {
      return (
        resolveComponentRefDeep(type.trueType, idToReflection, idToPath, parsed) ??
        resolveComponentRefDeep(type.falseType, idToReflection, idToPath, parsed)
      );
    }

    default: {
      return undefined;
    }
  }
}

// ── Type-string helpers ────────────────────────────────────────

function typeToString(type: TypeDocType | undefined): string {
  if (!type) return 'unknown';

  switch (type.type) {
    case 'intrinsic': {
      return type.name ?? 'unknown';
    }
    case 'reference': {
      return type.name ?? 'unknown';
    }
    case 'literal': {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string -- value is always a primitive from TypeDoc JSON
      return String(type.value);
    }
    case 'union': {
      return (type.types ?? []).map((t) => typeToString(t)).join(' | ');
    }
    case 'intersection': {
      return (type.types ?? []).map((t) => typeToString(t)).join(' & ');
    }
    case 'tuple': {
      return `[${(type.elements ?? []).map((t) => typeToString(t)).join(', ')}]`;
    }
    case 'array': {
      return `${typeToString(type.elementType)}[]`;
    }
    case 'reflection': {
      if (type.declaration?.signatures) {
        const sig = type.declaration.signatures[0];
        const params = (sig.parameters ?? [])
          .map((p) => `${p.name}: ${typeToString(p.type)}`)
          .join(', ');

        return `(${params}) => ${typeToString(sig.type)}`;
      }

      return 'object';
    }
    case 'conditional': {
      return `${typeToString(type.checkType)} extends ${typeToString(type.extendsType)} ? ${typeToString(type.trueType)} : ${typeToString(type.falseType)}`;
    }
    case 'indexedAccess': {
      return `${typeToString(type.objectType)}[${typeToString(type.indexType)}]`;
    }
    case 'inferred': {
      return `infer ${type.name}`;
    }
    case 'mapped': {
      return '{ [key: string]: unknown }';
    }
    case 'optional': {
      return `${typeToString(type.elementType)}?`;
    }
    case 'predicate': {
      return `${type.name} is ${typeToString(type.targetType)}`;
    }
    case 'query': {
      return `typeof ${type.queryType?.name}`;
    }
    case 'rest': {
      return `...${typeToString(type.elementType)}`;
    }
    case 'templateLiteral': {
      return (
        '`' +
        (type.head ?? '') +
        (type.tail?.map((t) => '${' + typeToString(t[0]) + '}' + t[1]).join('') ?? '') +
        '`'
      );
    }
    case 'typeOperator': {
      return `${type.operator} ${typeToString(type.target)}`;
    }

    default: {
      return 'unknown';
    }
  }
}

function extractTypeString(reflection: TypeDocReflection): string {
  if (reflection.signatures?.length) {
    const sig = reflection.signatures[0];
    const params = (sig.parameters ?? [])
      .map((p) => `${p.name}: ${typeToString(p.type)}`)
      .join(', ');

    return `(${params}) => ${typeToString(sig.type)}`;
  }

  if (!reflection.type) return 'unknown';

  return typeToString(reflection.type);
}

function typeToArgTypeInfo(type: TypeDocType | undefined): ArgTypeInfo {
  if (!type) return { category: 'other', raw: 'unknown' };

  switch (type.type) {
    case 'intrinsic': {
      const name: ArgTypeCategory = (type.name as ArgTypeCategory) ?? 'other';

      if (['string', 'number', 'boolean'].includes(name)) {
        return { category: name, raw: name };
      }

      return { category: 'other', raw: name };
    }

    case 'reference': {
      return { category: 'other', raw: type.name ?? 'unknown' };
    }

    case 'reflection': {
      if (type.declaration?.signatures?.length) {
        const raw = extractTypeString(type.declaration);

        return { category: 'function', raw };
      }

      if (type.declaration?.children?.length) {
        const props: Record<string, ArgTypeInfo> = {};

        for (const child of type.declaration.children) {
          if (child.kind === ReflectionKind.Property) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define -- hoisted
            props[child.name] = buildArgTypeInfo(child);
          }
        }

        return {
          category: 'object',
          raw: extractTypeString(type.declaration),
          properties: Object.keys(props).length > 0 ? props : undefined
        };
      }

      return { category: 'object', raw: typeToString(type) };
    }

    case 'union': {
      const literals = extractLiteralStrings(type);

      if (literals.length === (type.types ?? []).length && literals.length > 0) {
        return {
          category: 'enum',
          raw: typeToString(type),
          options: literals
        };
      }

      return { category: 'union', raw: typeToString(type) };
    }

    case 'array': {
      return {
        category: 'array',
        raw: typeToString(type),
        elementType: typeToArgTypeInfo(type.elementType)
      };
    }

    default: {
      return { category: 'other', raw: typeToString(type) };
    }
  }
}

function buildArgTypeInfo(reflection: TypeDocReflection): ArgTypeInfo {
  if (reflection.kind === ReflectionKind.Method) {
    return { category: 'function', raw: extractTypeString(reflection) };
  }

  if (!reflection.type) return { category: 'other', raw: 'unknown' };

  return typeToArgTypeInfo(reflection.type);
}

// ── Parse individual properties ────────────────────────────────

function isArgSignature(reflection: TypeDocReflection): boolean {
  return reflection.kind === ReflectionKind.Property || reflection.kind === ReflectionKind.Method;
}

function parseArgsProperty(
  prop: TypeDocReflection,
  ctx: ResolveContext
): Record<string, ArgInfo> {
  const args: Record<string, ArgInfo> = {};

  for (const child of memberReflections(prop, ctx)) {
    if (isArgSignature(child)) {
      args[child.name] = {
        type: buildArgTypeInfo(child),
        required: !isOptional(child),
        description: extractSummaryText(child.comment),
        defaultValue: extractDefaultValue(child)
      };
    }
  }

  // Recover members of references TypeDoc could not resolve (types imported
  // from files outside the JSON) — JSON-derived args win.
  for (const member of resolveExternalMembers(prop.type, ctx)) {
    if (!isArgName(member.name) || Object.hasOwn(args, member.name)) continue;

    args[member.name] = {
      type: argTypeInfoFromString(member.type),
      required: !member.optional,
      description: member.description,
      defaultValue: undefined
    };
  }

  return args;
}

/** An external (source-recovered) or reflected member usable as an arg. */
function isArgName(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

function parseBlocksProperty(
  prop: TypeDocReflection,
  ctx: ResolveContext,
  parsed: Map<number, ParsedSignature>
): Record<string, BlockInfo> {
  const blocks: Record<string, BlockInfo> = {};

  for (const child of memberReflections(prop, ctx)) {
    if (isPropertySignature(child)) {
      const params: BlockInfo['params'] = [];
      const blockType = extractTypeReflection(child);

      if (blockType?.kind === ReflectionKind.TypeLiteral) {
        for (const param of blockType.children ?? []) {
          params.push({
            name: param.name,
            type: extractTypeString(param),
            description: extractSummaryText(param.comment),
            componentRef: resolveComponentRefDeep(
              param.type,
              ctx.idToReflection,
              ctx.idToPath,
              parsed
            )
          });
        }
      }

      if (child.type?.type === 'tuple') {
        for (const el of child.type.elements ?? []) {
          if (el.type === 'namedTupleMember') {
            params.push({
              name: el.name ?? '',
              type: typeToString(el.element),
              componentRef: resolveComponentRefDeep(
                el.element,
                ctx.idToReflection,
                ctx.idToPath,
                parsed
              )
            });
          } else if (
            el.type === 'reflection' &&
            el.declaration?.kind === ReflectionKind.TypeLiteral
          ) {
            // Yield hash: one name-keyed entry per named member
            const hash: HashBlockParam = {};

            for (const param of el.declaration.children ?? []) {
              hash[param.name] = {
                name: param.name,
                type: extractTypeString(param),
                description: extractSummaryText(param.comment),
                componentRef: resolveComponentRefDeep(
                  param.type,
                  ctx.idToReflection,
                  ctx.idToPath,
                  parsed
                )
              };
            }

            params.push(hash);
          } else {
            params.push({
              name: `param${params.length}`,
              type: typeToString(el),
              componentRef: resolveComponentRefDeep(
                el,
                ctx.idToReflection,
                ctx.idToPath,
                parsed
              )
            });
          }
        }
      }

      blocks[child.name] = {
        params,
        description: extractSummaryText(child.comment)
      };
    }
  }

  // Recover blocks of references TypeDoc could not resolve
  for (const member of resolveExternalMembers(prop.type, ctx)) {
    if (!isArgName(member.name) || Object.hasOwn(blocks, member.name)) continue;

    blocks[member.name] = {
      params: [],
      description: member.description
    };
  }

  return blocks;
}

function parseElementProperty(prop: TypeDocReflection): string | undefined {
  const type = extractTypeString(prop);

  return type || undefined;
}

function parseStyleProperty(
  prop: TypeDocReflection,
  ctx: ResolveContext
): undefined | { customProperties: Record<string, string>; parts: Record<string, string> } {
  const result = {
    customProperties: {} as Record<string, string>,
    parts: {} as Record<string, string>
  };

  for (const child of memberReflections(prop, ctx)) {
    if (child.name === 'CustomProperties') {
      for (const cp of memberReflections(child, ctx)) {
        if (isPropertySignature(cp)) {
          result.customProperties[cp.name] =
            extractStringLiteralValue(cp) ?? extractSummaryText(cp.comment);
        }
      }
    }

    if (child.name === 'Parts') {
      for (const part of memberReflections(child, ctx)) {
        if (isPropertySignature(part)) {
          result.parts[part.name] =
            extractStringLiteralValue(part) ?? extractSummaryText(part.comment);
        }
      }
    }
  }

  if (Object.keys(result.customProperties).length === 0 && Object.keys(result.parts).length === 0) {
    return undefined;
  }

  return result;
}

function assignProperty(
  child: TypeDocReflection,
  result: ComponentSignature,
  ctx: ResolveContext,
  parsed: Map<number, ParsedSignature>
) {
  switch (child.name) {
    case 'Args': {
      result.args = parseArgsProperty(child, ctx);

      break;
    }

    case 'Blocks': {
      result.blocks = parseBlocksProperty(child, ctx, parsed);

      break;
    }

    case 'Element': {
      result.element = parseElementProperty(child);

      break;
    }

    case 'Style': {
      const style = parseStyleProperty(child, ctx);

      if (style) {
        result.style = style;
      }

      break;
    }
  }
}

function parseSignatureProperty(
  prop: TypeDocReflection,
  ctx: ResolveContext,
  parsed: Map<number, ParsedSignature>
): ComponentSignature {
  const result: ComponentSignature = {
    args: {},
    blocks: {},
    element: undefined,
    style: { customProperties: {}, parts: {} }
  };

  for (const child of prop.children ?? []) {
    assignProperty(child, result, ctx, parsed);
  }

  return result;
}

function parseInterfaceSignature(
  reflection: TypeDocReflection,
  ctx: ResolveContext,
  parsed: Map<number, ParsedSignature>
): ComponentSignature | undefined {
  const name = reflection.name;

  if (name !== 'Signature' && !name.endsWith('Signature')) {
    return undefined;
  }

  const children = reflection.children ?? [];
  const hasArgs = children.some((c) => c.name === 'Args');
  const hasBlocks = children.some((c) => c.name === 'Blocks');
  const hasElement = children.some((c) => c.name === 'Element');
  const hasStyle = children.some((c) => c.name === 'Style');

  if (!hasArgs && !hasBlocks && !hasElement && !hasStyle) {
    return undefined;
  }

  return parseSignatureProperty(reflection, ctx, parsed);
}

// ── Extraction ─────────────────────────────────────────────────

function recurseChildren(reflection: TypeDocReflection, fn: (r: TypeDocReflection) => void) {
  for (const child of reflection.children ?? []) {
    fn(child);
    recurseChildren(child, fn);
  }
}

function extractInterfaceSignatures(
  project: JSONOutput.ProjectReflection,
  ctx: ResolveContext
): Map<number, ParsedSignature> {
  const result = new Map<number, ParsedSignature>();

  function add(reflection: TypeDocReflection) {
    if (reflection.kind !== ReflectionKind.Interface) return;

    const sig = parseInterfaceSignature(reflection, ctx, result);

    if (!sig) return;
    result.set(reflection.id, {
      sig,
      name: reflection.name,
      file: sourceFile(reflection)
    });
  }

  for (const child of project.children ?? []) {
    add(child);

    if (child.kind === ReflectionKind.Module || child.kind === ReflectionKind.Namespace) {
      recurseChildren(child, add);
    }
  }

  return result;
}

// ── Association ────────────────────────────────────────────────

function deriveComponentName(reflection: TypeDocReflection): string {
  return reflection.name === 'default' ? Default : reflection.name;
}

/**
 * Support template-only components declared with an inline signature literal
 * (`TOC<{ Args: …; Blocks: … }>`): the signature lives directly in the type
 * argument instead of a named interface. Returns undefined when the type
 * argument is not a signature-shaped literal.
 */
function parseInlineSignature(
  reflection: TypeDocReflection,
  ctx: ResolveContext,
  parsed: Map<number, ParsedSignature>
): ParsedSignature | undefined {
  if (reflection.type?.type !== 'reference') return undefined;

  const arg = reflection.type.typeArguments?.[0];

  if (arg?.type !== 'reflection' || !arg.declaration) return undefined;

  const names = new Set((arg.declaration.children ?? []).map((child) => child.name));
  const isSignature = ['Args', 'Blocks', 'Element', 'Style'].some((name) =>
    names.has(name)
  );

  if (!isSignature) return undefined;

  const sig = parseSignatureProperty(arg.declaration, ctx, parsed);

  return { sig, name: deriveComponentName(reflection), file: sourceFile(reflection) };
}

function resolveSigId(
  type: TypeDocType | undefined,
  parsed: Map<number, ParsedSignature>
): number | undefined {
  if (!type) return undefined;

  if (type.type === 'reference' && type.typeArguments) {
    for (const ta of type.typeArguments) {
      if (ta.type === 'reference') {
        // Numeric target — direct reflection ID
        if (typeof ta.target === 'number' && parsed.has(ta.target)) {
          return ta.target;
        }

        // Object target — external reference; look up by name
        if (typeof ta.target === 'object') {
          const qn = (ta.target as { qualifiedName?: string }).qualifiedName;

          if (qn) {
            for (const [id, entry] of parsed) {
              if (entry.name === qn) return id;
            }
          }
        }
      }
    }
  }

  return undefined;
}

function associateReflection(
  reflection: TypeDocReflection,
  ctx: ResolveContext,
  parsed: Map<number, ParsedSignature>,
  signatures: ComponentSignatureMap
) {
  if (reflection.variant === 'reference') return;

  // Must be a known Ember component
  if (!isEmberComponent(reflection.id, ctx.idToReflection, parsed)) return;

  let entry: ParsedSignature | undefined;

  // Class extends Component<Signature>
  if (reflection.kind === ReflectionKind.Class && reflection.extendedTypes) {
    for (const ext of reflection.extendedTypes) {
      const id = resolveSigId(ext, parsed);

      if (id !== undefined) {
        entry = parsed.get(id);
        if (entry) break;
      }
    }
  }

  // Variable typed as TOC<Signature>
  if (reflection.kind === ReflectionKind.Variable && !entry) {
    const id = resolveSigId(reflection.type, parsed);

    if (id !== undefined) {
      entry = parsed.get(id);
    }

    // Inline signature literal: TOC<{ Args: …; Blocks: …; Element: … }>
    if (!entry) {
      entry = parseInlineSignature(reflection, ctx, parsed);
    }

    // Verified wrapper with an unresolvable type argument (e.g. the legacy
    // `TemplateOnlyComponent<unknown>` pattern): fall back to a co-located
    // `*Signature` interface. Component identity is already proven by the
    // origin check — only the signature lookup uses co-location here.
    if (!entry && isSignatureWrapperReference(reflection.type)) {
      const file = sourceFile(reflection);

      if (file) {
        for (const candidate of parsed.values()) {
          if (candidate.file === file) {
            entry = candidate;

            break;
          }
        }
      }
    }
  }

  if (entry) {
    const name = deriveComponentName(reflection);
    const copy = { ...entry.sig, componentName: name };
    const filePath = normalizeReflectionPath(sourceFile(reflection) ?? '');

    (signatures[filePath] ??= {})[name] = copy;
  }
}

function associateComponents(
  project: JSONOutput.ProjectReflection,
  ctx: ResolveContext,
  parsed: Map<number, ParsedSignature>
): ComponentSignatureMap {
  const signatures: ComponentSignatureMap = {};

  function associate(reflection: TypeDocReflection) {
    associateReflection(reflection, ctx, parsed, signatures);
  }

  for (const child of project.children ?? []) {
    associate(child);
    recurseChildren(child, associate);
  }

  return signatures;
}

// ── Marker resolution ──────────────────────────────────────────

/**
 * Complete marker componentRefs by matching block param names to component
 * signatures in the same file. Marker refs are created when TypeDoc resolves
 * typeof ComponentX to a Glint utility type (like Invokable) — the original
 * component reference is lost but the modifier chain is preserved. The
 * component lives in the same file, so filePath is the file's own map key.
 */
function resolveMarkerRefs(signatures: ComponentSignatureMap): ComponentSignatureMap {
  for (const [filePath, compSigs] of Object.entries(signatures)) {
    const componentNames = Object.keys(compSigs);

    for (const compSig of Object.values(compSigs)) {
      for (const blockInfo of Object.values(compSig.blocks)) {
        for (const param of unwrapBlockParams(blockInfo.params)) {
          const isResolvedComponentType = ['Invokable', 'TOC', 'ComponentLike'].includes(
            param.type
          );

          if (
            isResolvedComponentType &&
            (!param.componentRef || param.componentRef.filePath === '') &&
            componentNames.includes(param.name)
          ) {
            param.componentRef = {
              filePath,
              exportName: param.name,
              modifiers: param.componentRef?.modifiers
            };
          }
        }
      }
    }
  }

  return signatures;
}

// ── Modifier enrichment ────────────────────────────────────────

/**
 * Recover WithBoundArgs/Omit/Pick wrappers from the source AST for block
 * params whose componentRef lost the wrapper structure in TypeDoc's output.
 * Requires real filesystem paths, resolved via the TypeDoc base directory.
 */
function enrichBlockParamModifiers(
  signatures: ComponentSignatureMap,
  base: string | undefined
): void {
  if (!base) return;

  for (const [relPath, compSigs] of Object.entries(signatures)) {
    const absKey = path.resolve(base, relPath);

    if (!existsSync(absKey)) continue;

    const modifiers = extractBlockParamModifiers(absKey);

    if (modifiers.length === 0) continue;

    for (const compSig of Object.values(compSigs)) {
      for (const blockInfo of Object.values(compSig.blocks)) {
        for (const param of unwrapBlockParams(blockInfo.params)) {
          if (
            param.componentRef &&
            !(param.componentRef.modifiers && param.componentRef.modifiers.length > 0)
          ) {
            const mod = modifiers.find((m) => m.paramName === param.name);

            if (mod) {
              param.componentRef.modifiers = [{ name: mod.wrapperName, typeArgs: mod.boundKeys }];
            }
          }
        }
      }
    }
  }
}

// ── Public API ─────────────────────────────────────────────────

export function analyzeTypedoc(
  reflections: JSONOutput.ProjectReflection,
  opts?: DocgenOptions
): ComponentSignatureMap {
  const { idToPath, idToReflection } = buildReflectionMaps(reflections);
  const base = resolveTsconfigBase(opts);
  const ctx: ResolveContext = { idToReflection, idToPath, base };
  const parsed = extractInterfaceSignatures(reflections, ctx);
  const signatures = associateComponents(reflections, ctx, parsed);

  resolveMarkerRefs(signatures);

  enrichBlockParamModifiers(signatures, base);

  return signatures;
}
