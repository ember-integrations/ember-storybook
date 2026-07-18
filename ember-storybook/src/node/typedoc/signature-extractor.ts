import path from 'node:path';

import { Default } from '../shared';

import type { ArgInfo, BlockInfo, ComponentSignature, ComponentSignatureMap } from './types';

// ── Types ──────────────────────────────────────────────────────

interface ParsedSignature {
  sig: ComponentSignature;
  name: string;
  file: string | undefined;
}

interface TypeDocProject {
  id: number;
  name: string;
  kind: number;
  children?: TypeDocReflection[];
}

interface TypeDocReflection {
  id: number;
  name: string;
  kind: number;
  variant?: string;
  kindString?: string;
  flags?: { isOptional?: boolean; isExported?: boolean };
  comment?: TypeDocComment;
  children?: TypeDocReflection[];
  sources?: { fileName: string; line: number }[];
  type?: TypeDocType;
  extendedTypes?: TypeDocType[];
  signatures?: TypeDocSignature[];
  parameters?: TypeDocReflection[];
}

interface TypeDocComment {
  summary?: { kind: string; text: string }[];
  blockTags?: { tag: string; content: { text: string }[] }[];
}

interface TypeDocSignature {
  id: number;
  name: string;
  kind: number;
  parameters?: TypeDocReflection[];
  type?: TypeDocType;
}

interface TypeDocType {
  type: string;
  name?: string;
  id?: number;
  target?: number | { packageName?: string; packagePath?: string; qualifiedName?: string };
  value?: unknown;
  types?: TypeDocType[];
  elements?: TypeDocType[];
  element?: TypeDocType;
  elementType?: TypeDocType;
  declaration?: TypeDocReflection;
  typeArguments?: TypeDocType[];
  objectType?: TypeDocType;
  indexType?: TypeDocType;
  checkType?: TypeDocType;
  extendsType?: TypeDocType;
  trueType?: TypeDocType;
  falseType?: TypeDocType;
  targetType?: TypeDocType;
  queryTypeName?: string;
  head?: string;
  tail?: [string, TypeDocType][];
  operator?: string;
  signatures?: TypeDocSignature[];
}

// ── Primitive helpers ──────────────────────────────────────────

function isPropertySignature(reflection: TypeDocReflection): boolean {
  return reflection.kind === 1024; // Property
}

function isOptional(reflection: TypeDocReflection): boolean {
  return reflection.flags?.isOptional ?? false;
}

function sourceFile(reflection: TypeDocReflection): string | undefined {
  return reflection.sources?.[0]?.fileName;
}

function extractSummaryText(comment: TypeDocComment | undefined): string {
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
    return defaultValueTag.content.map((c) => c.text).join(' ');
  }

  return undefined;
}

function extractStringLiteralValue(reflection: TypeDocReflection): string | undefined {
  if (reflection.type?.type === 'stringLiteral' && typeof reflection.type.value === 'string') {
    return reflection.type.value;
  }

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

// ── Reflection map ─────────────────────────────────────────────

function normalizeReflectionPath(fileName: string): string {
  return fileName.replace(/\.(gts|gjs)\.ts$/, '.$1');
}

function buildReflectionMap(
  project: TypeDocProject
): Map<number, { filePath: string; name: string }> {
  const map = new Map<number, { filePath: string; name: string }>();

  function walk(reflection: TypeDocReflection) {
    if (reflection.sources?.[0]?.fileName) {
      map.set(reflection.id, {
        filePath: normalizeReflectionPath(reflection.sources[0].fileName),
        name: reflection.name === 'default' ? Default : reflection.name
      });
    }

    for (const child of reflection.children ?? []) {
      walk(child);
    }
  }

  walk(project);

  return map;
}

function resolveComponentTypeRef(
  type: TypeDocType | undefined,
  reflectionMap: Map<number, { filePath: string; name: string }>,
  projectRoot: string
): undefined | { filePath: string; exportName: string } {
  if (type?.type !== 'reference') return undefined;

  const target = type.target;

  if (typeof target === 'number') {
    const resolved = reflectionMap.get(target);

    if (!resolved) return undefined;

    return {
      filePath: path
        .relative(projectRoot, path.resolve(projectRoot, resolved.filePath))
        .replaceAll('\\', '/'),
      exportName: resolved.name
    };
  }

  if (target && typeof target === 'object') {
    const { packagePath, qualifiedName } = target as {
      packagePath?: string;
      qualifiedName?: string;
    };

    if (packagePath && qualifiedName) {
      return {
        filePath: path
          .relative(projectRoot, path.resolve(projectRoot, packagePath))
          .replaceAll('\\', '/'),
        exportName: qualifiedName
      };
    }
  }

  return undefined;
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
    case 'stringLiteral': {
      return `'${String(type.value)}'`;
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
    case 'literal': {
      return String(type.value);
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
      return `typeof ${type.queryTypeName}`;
    }
    case 'rest': {
      return `...${typeToString(type.elementType)}`;
    }
    case 'templateLiteral': {
      return (
        '`' +
        (type.head ?? '') +
        (type.tail?.map((t) => '${' + typeToString(t[1]) + '}' + t[0]).join('') ?? '') +
        '`'
      );
    }
    case 'typeOperator': {
      return `${type.operator} ${typeToString(type.elementType)}`;
    }

    default: {
      return 'unknown';
    }
  }
}

function extractTypeString(reflection: TypeDocReflection): string {
  if (!reflection.type) return 'unknown';

  return typeToString(reflection.type);
}

// ── Parse individual properties ────────────────────────────────

function parseArgsProperty(prop: TypeDocReflection): Record<string, ArgInfo> {
  const args: Record<string, ArgInfo> = {};

  const members = prop.type?.declaration?.children ?? prop.children ?? [];

  for (const child of members) {
    if (isPropertySignature(child)) {
      args[child.name] = {
        type: extractTypeString(child),
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
  reflectionMap: Map<number, { filePath: string; name: string }>,
  projectRoot: string
): Record<string, BlockInfo> {
  const blocks: Record<string, BlockInfo> = {};

  const members = prop.type?.declaration?.children ?? prop.children ?? [];

  for (const child of members) {
    if (isPropertySignature(child)) {
      const params: {
        name: string;
        type: string;
        description?: string;
        componentRef?: { filePath: string; exportName: string };
      }[] = [];
      const blockType = extractTypeReflection(child);

      if (blockType?.kind === 65_536 /* TypeLiteral */) {
        for (const param of blockType.children ?? []) {
          params.push({
            name: param.name,
            type: extractTypeString(param),
            description: extractSummaryText(param.comment),
            componentRef: resolveComponentTypeRef(param.type, reflectionMap, projectRoot)
          });
        }
      }

      if (child.type?.type === 'tuple') {
        for (const el of child.type.elements ?? []) {
          if (el.type === 'namedTupleMember') {
            params.push({
              name: el.name ?? '',
              type: typeToString(el.element),
              componentRef: resolveComponentTypeRef(el.element, reflectionMap, projectRoot)
            });
          } else {
            params.push({
              name: `param${params.length}`,
              type: typeToString(el),
              componentRef: resolveComponentTypeRef(el, reflectionMap, projectRoot)
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

  const members = prop.type?.declaration?.children ?? prop.children ?? [];

  for (const child of members) {
    if (child.name === 'CustomProperties') {
      const cpMembers = child.type?.declaration?.children ?? child.children ?? [];

      for (const cp of cpMembers) {
        if (isPropertySignature(cp)) {
          result.customProperties[cp.name] =
            extractStringLiteralValue(cp) ?? extractSummaryText(cp.comment);
        }
      }
    }

    if (child.name === 'Parts') {
      const partMembers = child.type?.declaration?.children ?? child.children ?? [];

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
  reflectionMap: Map<number, { filePath: string; name: string }>,
  projectRoot: string
) {
  switch (child.name) {
    case 'Args': {
      result.args = parseArgsProperty(child);

      break;
    }

    case 'Blocks': {
      result.blocks = parseBlocksProperty(child, reflectionMap, projectRoot);

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
  reflectionMap: Map<number, { filePath: string; name: string }>,
  projectRoot: string
): ComponentSignature {
  const result: ComponentSignature = {
    args: {},
    blocks: {},
    element: undefined,
    style: { customProperties: {}, parts: {} }
  };

  for (const child of prop.children ?? []) {
    assignProperty(child, result, reflectionMap, projectRoot);
  }

  return result;
}

function parseInterfaceSignature(
  reflection: TypeDocReflection,
  reflectionMap: Map<number, { filePath: string; name: string }>,
  projectRoot: string
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

  return parseSignatureProperty(reflection, reflectionMap, projectRoot);
}

// ── Extraction ─────────────────────────────────────────────────

function recurseChildren(reflection: TypeDocReflection, fn: (r: TypeDocReflection) => void) {
  for (const child of reflection.children ?? []) {
    fn(child);
    recurseChildren(child, fn);
  }
}

function extractInterfaceSignatures(
  project: TypeDocProject,
  reflectionMap: Map<number, { filePath: string; name: string }>,
  projectRoot: string
): Map<number, ParsedSignature> {
  const result = new Map<number, ParsedSignature>();

  function add(reflection: TypeDocReflection) {
    if (reflection.kind !== 256) return;

    const sig = parseInterfaceSignature(reflection, reflectionMap, projectRoot);

    if (!sig) return;
    result.set(reflection.id, {
      sig,
      name: reflection.name,
      file: sourceFile(reflection)
    });
  }

  for (const child of project.children ?? []) {
    add(child);

    if (child.kind === 2 /* Module */ || child.kind === 4 /* Namespace */) {
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
  parsed: Map<number, ParsedSignature>,
  signatures: ComponentSignatureMap
) {
  if (reflection.variant === 'reference') return;

  let entry: ParsedSignature | undefined;

  // Class extends Component<Signature>
  if (reflection.kind === 128 /* Class */ && reflection.extendedTypes) {
    for (const ext of reflection.extendedTypes) {
      const id = resolveSigId(ext, parsed);

      if (id !== undefined) {
        entry = parsed.get(id);
        if (entry) break;
      }
    }
  }

  // Variable typed as TOC<Signature>
  if (reflection.kind === 32 /* Variable */ && !entry) {
    const id = resolveSigId(reflection.type, parsed);

    if (id !== undefined) {
      entry = parsed.get(id);
    }
  }

  if (entry) {
    const name = deriveComponentName(reflection);
    const copy = { ...entry.sig, componentName: name };
    const filePath = sourceFile(reflection) ?? '';

    (signatures[filePath] ??= {})[name] = copy;

    return;
  }

  // File-based fallback: for components (class/variable) whose type
  // argument link couldn't be resolved, look for a signature interface
  // defined in the same source file. Handles:
  //   - non-exported interfaces (GreetingSignature in greeting.gts)
  //   - satisfies TOC<Signature> pattern (Header in header.gts)
  if (reflection.kind === 32 || reflection.kind === 128) {
    const file = sourceFile(reflection);

    if (!file) return;

    for (const candidate of parsed.values()) {
      if (candidate.file === file) {
        const copy = { ...candidate.sig, componentName: deriveComponentName(reflection) };

        (signatures[file] ??= {})[copy.componentName] = copy;

        return;
      }
    }
  }
}

function associateComponents(
  project: TypeDocProject,
  parsed: Map<number, ParsedSignature>
): ComponentSignatureMap {
  const signatures: ComponentSignatureMap = {};

  function associate(reflection: TypeDocReflection) {
    associateReflection(reflection, parsed, signatures);
  }

  for (const child of project.children ?? []) {
    associate(child);
    recurseChildren(child, associate);
  }

  return signatures;
}

// ── Public API ─────────────────────────────────────────────────

export function extractSignatures(
  reflections: TypeDocProject,
  projectRoot: string
): ComponentSignatureMap {
  const reflectionMap = buildReflectionMap(reflections);
  const parsed = extractInterfaceSignatures(reflections, reflectionMap, projectRoot);

  return associateComponents(reflections, parsed);
}
