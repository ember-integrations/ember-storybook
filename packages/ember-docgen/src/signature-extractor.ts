import { existsSync } from 'node:fs';
import path from 'node:path';

/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * JSONOutput types are strict discriminated unions, but the data comes
 * from deserialized JSON at runtime so every property is nullable. */
import { ReflectionKind } from 'typedoc';

import { extractBlockParamModifiers } from './parser';
import { resolveTsconfigBase } from './config';
import { Default } from './types';

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
} from './types';
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

// ── Block param helpers ────────────────────────────────────────

function isBlockParam(param: BlockParam | HashBlockParam): param is BlockParam {
  return Object.hasOwn(param, 'name') && Object.hasOwn(param, 'type');
}

/** Flatten the params union into plain block params, unwrapping yield hashes. */
export function unwrapBlockParams(params: BlockInfo['params']): BlockParam[] {
  return params.flatMap((param) => (isBlockParam(param) ? [param] : Object.values(param)));
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

  // Class extends Component<Signature>
  if (reflection.kind === ReflectionKind.Class && reflection.extendedTypes) {
    for (const ext of reflection.extendedTypes) {
      if (ext.type === 'reference' && ext.name === 'Component') return true;
    }
  }

  // Variable typed as TOC<Signature> / ComponentLike<S> / Invokable<...>
  if (
    reflection.kind === ReflectionKind.Variable &&
    reflection.type?.type === 'reference' &&
    reflection.type.name &&
    ['TOC', 'ComponentLike', 'Invokable'].includes(reflection.type.name)
  ) {
    return true;
  }

  // Fallback: class/variable in a file with a *Signature interface
  const file = sourceFile(reflection);

  if (!file) return false;

  for (const candidate of parsed.values()) {
    if (candidate.file === file) return true;
  }

  return false;
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
        // (where X extends Component) to Invokable, losing the original reference.
        const GLINT_UTILITY_TYPES = [
          'Invokable',
          'TOC',
          'ComponentLike',
          'HelperLike',
          'ModifierLike'
        ];

        if (qualifiedName && GLINT_UTILITY_TYPES.includes(qualifiedName)) {
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

function parseArgsProperty(prop: TypeDocReflection): Record<string, ArgInfo> {
  const args: Record<string, ArgInfo> = {};

  const members =
    (prop.type?.type === 'reflection' ? prop.type.declaration?.children : undefined) ??
    prop.children ??
    [];

  for (const child of members) {
    if (isArgSignature(child)) {
      args[child.name] = {
        type: buildArgTypeInfo(child),
        required: !isOptional(child),
        description: extractSummaryText(child.comment),
        defaultValue: extractDefaultValue(child)
      };
    }
  }

  return args;
}

function parseBlocksProperty(
  prop: TypeDocReflection,
  idToReflection: Map<number, TypeDocReflection>,
  idToPath: Map<number, { filePath: string; name: string }>,
  parsed: Map<number, ParsedSignature>
): Record<string, BlockInfo> {
  const blocks: Record<string, BlockInfo> = {};

  const members =
    (prop.type?.type === 'reflection' ? prop.type.declaration?.children : undefined) ??
    prop.children ??
    [];

  for (const child of members) {
    if (isPropertySignature(child)) {
      const params: BlockInfo['params'] = [];
      const blockType = extractTypeReflection(child);

      if (blockType?.kind === ReflectionKind.TypeLiteral) {
        for (const param of blockType.children ?? []) {
          params.push({
            name: param.name,
            type: extractTypeString(param),
            description: extractSummaryText(param.comment),
            componentRef: resolveComponentRefDeep(param.type, idToReflection, idToPath, parsed)
          });
        }
      }

      if (child.type?.type === 'tuple') {
        for (const el of child.type.elements ?? []) {
          if (el.type === 'namedTupleMember') {
            params.push({
              name: el.name ?? '',
              type: typeToString(el.element),
              componentRef: resolveComponentRefDeep(el.element, idToReflection, idToPath, parsed)
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
                  idToReflection,
                  idToPath,
                  parsed
                )
              };
            }

            params.push(hash);
          } else {
            params.push({
              name: `param${params.length}`,
              type: typeToString(el),
              componentRef: resolveComponentRefDeep(el, idToReflection, idToPath, parsed)
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

  return blocks;
}

function parseElementProperty(prop: TypeDocReflection): string | undefined {
  const type = extractTypeString(prop);

  return type || undefined;
}

function parseStyleProperty(
  prop: TypeDocReflection
): undefined | { customProperties: Record<string, string>; parts: Record<string, string> } {
  const result = {
    customProperties: {} as Record<string, string>,
    parts: {} as Record<string, string>
  };

  const members =
    (prop.type?.type === 'reflection' ? prop.type.declaration?.children : undefined) ??
    prop.children ??
    [];

  for (const child of members) {
    if (child.name === 'CustomProperties') {
      const cpMembers =
        (child.type?.type === 'reflection' ? child.type.declaration?.children : undefined) ??
        child.children ??
        [];

      for (const cp of cpMembers) {
        if (isPropertySignature(cp)) {
          result.customProperties[cp.name] =
            extractStringLiteralValue(cp) ?? extractSummaryText(cp.comment);
        }
      }
    }

    if (child.name === 'Parts') {
      const partMembers =
        (child.type?.type === 'reflection' ? child.type.declaration?.children : undefined) ??
        child.children ??
        [];

      for (const part of partMembers) {
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
  idToReflection: Map<number, TypeDocReflection>,
  idToPath: Map<number, { filePath: string; name: string }>,
  parsed: Map<number, ParsedSignature>
) {
  switch (child.name) {
    case 'Args': {
      result.args = parseArgsProperty(child);

      break;
    }

    case 'Blocks': {
      result.blocks = parseBlocksProperty(child, idToReflection, idToPath, parsed);

      break;
    }

    case 'Element': {
      result.element = parseElementProperty(child);

      break;
    }

    case 'Style': {
      const style = parseStyleProperty(child);

      if (style) {
        result.style = style;
      }

      break;
    }
  }
}

function parseSignatureProperty(
  prop: TypeDocReflection,
  idToReflection: Map<number, TypeDocReflection>,
  idToPath: Map<number, { filePath: string; name: string }>,
  parsed: Map<number, ParsedSignature>
): ComponentSignature {
  const result: ComponentSignature = {
    args: {},
    blocks: {},
    element: undefined,
    style: { customProperties: {}, parts: {} }
  };

  for (const child of prop.children ?? []) {
    assignProperty(child, result, idToReflection, idToPath, parsed);
  }

  return result;
}

function parseInterfaceSignature(
  reflection: TypeDocReflection,
  idToReflection: Map<number, TypeDocReflection>,
  idToPath: Map<number, { filePath: string; name: string }>,
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

  return parseSignatureProperty(reflection, idToReflection, idToPath, parsed);
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
  idToReflection: Map<number, TypeDocReflection>,
  idToPath: Map<number, { filePath: string; name: string }>
): Map<number, ParsedSignature> {
  const result = new Map<number, ParsedSignature>();

  function add(reflection: TypeDocReflection) {
    if (reflection.kind !== ReflectionKind.Interface) return;

    const sig = parseInterfaceSignature(reflection, idToReflection, idToPath, result);

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
  idToReflection: Map<number, TypeDocReflection>,
  parsed: Map<number, ParsedSignature>,
  signatures: ComponentSignatureMap
) {
  if (reflection.variant === 'reference') return;

  // Must be a known Ember component
  if (!isEmberComponent(reflection.id, idToReflection, parsed)) return;

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
  }

  if (entry) {
    const name = deriveComponentName(reflection);
    const copy = { ...entry.sig, componentName: name };
    const filePath = normalizeReflectionPath(sourceFile(reflection) ?? '');

    (signatures[filePath] ??= {})[name] = copy;

    return;
  }

  // File-based fallback: if isEmberComponent returned true via the fallback
  // (same-file *Signature interface), find it now.
  const file = sourceFile(reflection);

  if (!file) return;

  for (const candidate of parsed.values()) {
    if (candidate.file === file) {
      const copy = { ...candidate.sig, componentName: deriveComponentName(reflection) };
      const filePath = normalizeReflectionPath(file);

      (signatures[filePath] ??= {})[copy.componentName] = copy;

      return;
    }
  }
}

function associateComponents(
  project: JSONOutput.ProjectReflection,
  idToReflection: Map<number, TypeDocReflection>,
  parsed: Map<number, ParsedSignature>
): ComponentSignatureMap {
  const signatures: ComponentSignatureMap = {};

  function associate(reflection: TypeDocReflection) {
    associateReflection(reflection, idToReflection, parsed, signatures);
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

export function analyze(
  reflections: JSONOutput.ProjectReflection,
  opts?: DocgenOptions
): ComponentSignatureMap {
  const { idToPath, idToReflection } = buildReflectionMaps(reflections);
  const parsed = extractInterfaceSignatures(reflections, idToReflection, idToPath);
  const signatures = associateComponents(reflections, idToReflection, parsed);

  resolveMarkerRefs(signatures);

  const base = resolveTsconfigBase(opts);

  enrichBlockParamModifiers(signatures, base);

  return signatures;
}
