import { readFileSync } from 'node:fs';

import { Preprocessor } from 'content-tag';
import { parseSync, Visitor } from 'oxc-parser';

export interface BlockParamModifier {
  paramName: string;
  wrapperName: string;
  boundKeys: string[];
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
