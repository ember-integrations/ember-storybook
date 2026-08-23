import { readFileSync } from 'node:fs';

import { Preprocessor } from 'content-tag';
import { parseSync, Visitor } from 'oxc-parser';

export interface BlockParamModifier {
  paramName: string;
  wrapperName: string;
  boundKeys: string[];
}

/** A property/method member extracted from a source file's type declaration. */
export interface ExternalTypeMember {
  name: string;
  optional: boolean;
  /** Raw type text (e.g. `string`, `'a' | 'b'`, `(value: boolean) => void`) */
  type: string;
  description: string;
}

function readAndPreprocess(filePath: string): string {
  const rawCode = readFileSync(filePath, 'utf8');

  if (!filePath.endsWith('.gts') && !filePath.endsWith('.gjs')) {
    return rawCode;
  }

  const pp = new Preprocessor();

  return pp.process(rawCode, { filename: filePath }).code;
}

function isStringLiteralType(node: Record<string, unknown>): string | undefined {
  if (node.type === 'TSLiteralType') {
    const literal = node.literal as Record<string, unknown> | undefined;

    if (literal?.type === 'Literal') {
      return String(literal.value);
    }
  }

  return undefined;
}

function collectStringLiterals(node: Record<string, unknown>): string[] {
  const str = isStringLiteralType(node);

  if (str !== undefined) return [str];

  if (node.type === 'TSUnionType') {
    const types = node.types as Record<string, unknown>[] | undefined;

    return (types ?? []).flatMap((t) => collectStringLiterals(t));
  }

  return [];
}

function extractModifierFromType(
  node: Record<string, unknown>
): undefined | { wrapperName: string; boundKeys: string[] } {
  if (node.type !== 'TSTypeReference') return undefined;

  const typeName = node.typeName as Record<string, unknown> | undefined;

  if (typeName?.type !== 'Identifier') return undefined;

  const wrapperName = typeName.name as string;
  const typeArgs = node.typeArguments as Record<string, unknown> | undefined;

  if (typeArgs?.type !== 'TSTypeParameterInstantiation') return undefined;

  const params = typeArgs.params as Record<string, unknown>[] | undefined;

  if (!params || params.length === 0) return undefined;

  // Collect string literals from all type parameters
  const boundKeys = params.flatMap((p) => collectStringLiterals(p));

  if (boundKeys.length === 0) return undefined;

  return { wrapperName, boundKeys };
}

/**
 * Walk the type tree to find the first modifier (TSTypeReference with string
 * literal type arguments) nested anywhere inside the given type node.
 */
function findNestedModifier(
  node: Record<string, unknown>
): undefined | { wrapperName: string; boundKeys: string[] } {
  const mod = extractModifierFromType(node);

  if (mod) return mod;

  if (node.type === 'TSTypeReference') {
    const typeArgs = node.typeArguments as Record<string, unknown> | undefined;

    if (typeArgs?.type === 'TSTypeParameterInstantiation') {
      const params = typeArgs.params as Record<string, unknown>[] | undefined;

      for (const param of params ?? []) {
        const inner = findNestedModifier(param);

        if (inner) return inner;
      }
    }
  }

  if (node.type === 'TSIntersectionType' || node.type === 'TSUnionType') {
    const types = node.types as Record<string, unknown>[] | undefined;

    for (const t of types ?? []) {
      const inner = findNestedModifier(t);

      if (inner) return inner;
    }
  }

  if (node.type === 'TSTypeLiteral') {
    const members = node.members as Record<string, unknown>[] | undefined;

    for (const member of members ?? []) {
      if (member.type === 'TSPropertySignature') {
        const ta = member.typeAnnotation as
          undefined | { typeAnnotation?: Record<string, unknown> };
        const innerType = ta?.typeAnnotation;

        if (!innerType) continue;

        const inner = findNestedModifier(innerType);

        if (inner) return inner;
      }
    }
  }

  return undefined;
}

function extractParamModifiersFromType(
  typeNode: Record<string, unknown>,
  modifiers: BlockParamModifier[]
): void {
  if (typeNode.type === 'TSTupleType') {
    const elementTypes = typeNode.elementTypes as Record<string, unknown>[] | undefined;

    for (const el of elementTypes ?? []) {
      if (el.type === 'TSTypeLiteral') {
        const members = el.members as Record<string, unknown>[] | undefined;

        for (const member of members ?? []) {
          if (member.type === 'TSPropertySignature') {
            const key = member.key as Record<string, unknown> | undefined;
            const paramName = key?.type === 'Identifier' ? (key.name as string) : undefined;

            if (paramName) {
              const ta = member.typeAnnotation as Record<string, unknown> | undefined;
              const innerType = ta?.typeAnnotation as Record<string, unknown> | undefined;

              if (innerType) {
                const mod = extractModifierFromType(innerType) ?? findNestedModifier(innerType);

                if (mod) {
                  modifiers.push({ paramName, ...mod });
                } else {
                  extractParamModifiersFromType(innerType, modifiers);
                }
              }
            }
          }
        }
      }
    }
  }

  // TSTypeReference with type arguments — walk into them (e.g. ComponentLike<{...}>)
  if (typeNode.type === 'TSTypeReference') {
    const typeArgs = typeNode.typeArguments as Record<string, unknown> | undefined;

    if (typeArgs?.type === 'TSTypeParameterInstantiation') {
      const params = typeArgs.params as Record<string, unknown>[] | undefined;

      for (const param of params ?? []) {
        extractParamModifiersFromType(param, modifiers);
      }
    }
  }

  // Intersection types (e.g. Omit<...> & { kind?: ... })
  if (typeNode.type === 'TSIntersectionType') {
    const types = typeNode.types as Record<string, unknown>[] | undefined;

    for (const t of types ?? []) {
      extractParamModifiersFromType(t, modifiers);
    }
  }

  // Named block params: recurse into nested types to find tuple-based patterns.
  if (typeNode.type === 'TSTypeLiteral') {
    const members = typeNode.members as Record<string, unknown>[] | undefined;

    for (const member of members ?? []) {
      if (member.type === 'TSPropertySignature') {
        const ta = member.typeAnnotation as
          undefined | { typeAnnotation?: Record<string, unknown> };
        const innerType = ta?.typeAnnotation;

        if (innerType) {
          extractParamModifiersFromType(innerType, modifiers);
        }
      }
    }
  }
}

export function extractBlockParamModifiers(filePath: string): BlockParamModifier[] {
  const code = readAndPreprocess(filePath);

  const program = parseSync(filePath, code, {
    lang: filePath.endsWith('.gts') || filePath.endsWith('.ts') ? 'ts' : 'js',
    sourceType: 'module'
  }).program;

  const modifiers: BlockParamModifier[] = [];

  const visitor = new Visitor({
    TSPropertySignature(node) {
      const key = node.key as unknown as undefined | { type?: string; name?: string };

      if (key?.type !== 'Identifier') return;
      if (key.name !== 'Blocks') return;

      const ta = node.typeAnnotation as unknown as
        undefined | { typeAnnotation?: Record<string, unknown> };
      const innerType = ta?.typeAnnotation;

      if (!innerType) return;

      extractParamModifiersFromType(innerType, modifiers);
    }
  });

  visitor.visit(program);

  return modifiers;
}

// ── External type member extraction ────────────────────────────

interface RawComment {
  type: string;
  value: string;
  start: number;
  end: number;
}

type AstNode = Record<string, unknown> & { start?: number; end?: number };

function nodeName(node: AstNode | undefined): string | undefined {
  const key = node?.key as AstNode | undefined;
  const id = node?.id as AstNode | undefined;

  return (key?.name ?? id?.name) as string | undefined;
}

/** Text of a JSDoc-ish comment, stripped of comment markers and asterisks. */
function cleanComment(comment: RawComment): string {
  return comment.value
    .split('\n')
    .map((line) => line.replace(/^\s*\*/, '').trim())
    .filter(Boolean)
    .join(' ');
}

function descriptionFor(member: { start?: number }, comments: RawComment[], code: string): string {
  let found: RawComment | undefined;

  for (const comment of comments) {
    if (
      member.start !== undefined &&
      comment.end <= member.start &&
      comment.end > (found?.end ?? -1) &&
      code.slice(comment.end, member.start).trim() === ''
    ) {
      found = comment;
    }
  }

  return found ? cleanComment(found) : '';
}

function memberFromProperty(
  node: AstNode,
  code: string,
  comments: RawComment[]
): ExternalTypeMember | undefined {
  const name = nodeName(node);

  if (!name) return undefined;

  const annotation = node.typeAnnotation as
    | undefined
    | { typeAnnotation?: AstNode & { start?: number; end?: number } };
  const inner = annotation?.typeAnnotation;

  const type =
    inner?.start !== undefined && inner?.end !== undefined
      ? code.slice(inner.start, inner.end)
      : 'unknown';

  return {
    name,
    optional: node.optional === true,
    type,
    description: descriptionFor(node, comments, code)
  };
}

function memberFromMethod(
  node: AstNode,
  code: string,
  comments: RawComment[]
): ExternalTypeMember | undefined {
  const name = nodeName(node);

  if (!name) return undefined;

  const params = ((node.params ?? []) as AstNode[])
    .map((param) => code.slice(param.start ?? 0, param.end ?? 0))
    .join(', ');

  const returnTypeAnnotation = (
    node.returnType as undefined | { typeAnnotation?: AstNode & { start?: number; end?: number } }
  )?.typeAnnotation;

  const returnType =
    returnTypeAnnotation?.start !== undefined && returnTypeAnnotation?.end !== undefined
      ? code.slice(returnTypeAnnotation.start, returnTypeAnnotation.end)
      : 'void';

  return {
    name,
    optional: node.optional === true,
    type: `(${params}) => ${returnType}`,
    description: descriptionFor(node, comments, code)
  };
}

function membersFromTypeLiteral(
  node: AstNode,
  code: string,
  comments: RawComment[]
): ExternalTypeMember[] {
  const body = (node.members ?? []) as AstNode[];

  return body.flatMap((member) => {
    if (member.type === 'TSPropertySignature') {
      const result = memberFromProperty(member, code, comments);

      return result ? [result] : [];
    }

    if (member.type === 'TSMethodSignature') {
      const result = memberFromMethod(member, code, comments);

      return result ? [result] : [];
    }

    return [];
  });
}

function membersFromTypeNode(
  node: AstNode,
  declarations: Map<string, AstNode>,
  visited: Set<string>,
  code: string,
  comments: RawComment[]
): ExternalTypeMember[] {
  if (node.type === 'TSTypeLiteral') {
    return membersFromTypeLiteral(node, code, comments);
  }

  // Interface bodies wrap their members in a list
  if (node.type === 'TSInterfaceBody') {
    return membersFromTypeLiteral({ members: node.body } as AstNode, code, comments);
  }

  // Intersection — merge the parts
  if (node.type === 'TSIntersectionType') {
    return ((node.types ?? []) as AstNode[]).flatMap((part) =>
      membersFromTypeNode(part, declarations, visited, code, comments)
    );
  }

  // Reference to another named type in the same file
  if (node.type === 'TSTypeReference') {
    const typeName = (node.typeName as AstNode | undefined)?.name as string | undefined;

    if (typeName && !visited.has(typeName)) {
      const declaration = declarations.get(typeName);

      if (declaration) {
        visited.add(typeName);

        const annotation = (declaration.typeAnnotation ?? declaration.body ?? {}) as AstNode;

        return membersFromTypeNode(annotation, declarations, visited, code, comments);
      }
    }
  }

  return [];
}

/**
 * Extract the property/method members of a named type declaration
 * (interface or type alias) directly from a source file. Used by analyze()
 * to resolve references to types that live outside the TypeDoc JSON.
 */
export function extractTypeMembers(filePath: string, typeName: string): ExternalTypeMember[] {
  let code: string;

  try {
    code = readAndPreprocess(filePath);
  } catch {
    return [];
  }

  const lang = filePath.endsWith('.gts') || filePath.endsWith('.ts') ? 'ts' : 'js';

  const parsed = parseSync(filePath, code, { lang, sourceType: 'module' });

  if ((parsed.errors?.length ?? 0) > 0) {
    return [];
  }

  const comments = (parsed.comments ?? []) as RawComment[];
  const declarations = new Map<string, AstNode>();

  for (const statement of parsed.program.body as unknown as AstNode[]) {
    const declaration = (statement.declaration ?? statement) as AstNode;
    const name = nodeName(declaration);

    if (
      name &&
      (declaration.type === 'TSInterfaceDeclaration' ||
        declaration.type === 'TSTypeAliasDeclaration')
    ) {
      declarations.set(name, declaration);
    }
  }

  const declaration = declarations.get(typeName);

  if (!declaration) return [];

  const annotation = (declaration.typeAnnotation ?? declaration.body ?? {}) as AstNode;

  return membersFromTypeNode(annotation, declarations, new Set([typeName]), code, comments);
}
