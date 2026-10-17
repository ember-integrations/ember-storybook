/**
 * Read plain values (strings, numbers, booleans, null, and arrays and objects of
 * those) out of the Babel AST nodes Storybook's CSF parser keeps for meta and
 * story annotations. Anything computed, like a `fn()` spy, is not static.
 */

interface Node {
  type: string;
  [key: string]: unknown;
}

const NOT_STATIC = Symbol('not static');

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function propertyKey(property: Node): string | undefined {
  if (property.computed) return undefined;

  const key = property.key as Node;

  if (key.type === 'Identifier') return key.name as string;
  if (key.type === 'StringLiteral') return key.value as string;

  return undefined;
}

function evaluate(node: Node): unknown {
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral': {
      return node.value;
    }

    // "Show code" skips null and undefined args alike.
    case 'NullLiteral': {
      return undefined;
    }

    case 'TemplateLiteral': {
      const quasis = node.quasis as Node[];

      return (node.expressions as Node[]).length === 0
        ? (quasis[0]?.value as { cooked: string }).cooked
        : NOT_STATIC;
    }

    case 'UnaryExpression': {
      const argument = node.argument as Node;

      return node.operator === '-' && argument.type === 'NumericLiteral'
        ? -(argument.value as number)
        : NOT_STATIC;
    }

    case 'ArrayExpression': {
      const values = (node.elements as (Node | null)[]).map((element) =>
        element ? evaluate(element) : NOT_STATIC
      );

      return values.includes(NOT_STATIC) ? NOT_STATIC : values;
    }

    case 'ObjectExpression': {
      const result: Record<string, unknown> = {};

      for (const property of node.properties as Node[]) {
        const key = property.type === 'ObjectProperty' ? propertyKey(property) : undefined;
        const value = key === undefined ? NOT_STATIC : evaluate(property.value as Node);

        if (key === undefined || value === NOT_STATIC) return NOT_STATIC;

        result[key] = value;
      }

      return result;
    }

    default: {
      return NOT_STATIC;
    }
  }
}

/** The properties of an object literal whose values are static; the rest are left out. */
export function staticProperties(node: unknown): Record<string, unknown> {
  if (!isNode(node) || node.type !== 'ObjectExpression') return {};

  const result: Record<string, unknown> = {};

  for (const property of node.properties as Node[]) {
    if (property.type !== 'ObjectProperty') continue;

    const key = propertyKey(property);
    const value = evaluate(property.value as Node);

    if (key !== undefined && value !== NOT_STATIC) {
      result[key] = value;
    }
  }

  return result;
}

function staticPropertyNode(node: unknown, name: string): Node | undefined {
  if (!isNode(node) || node.type !== 'ObjectExpression') return undefined;

  for (const property of node.properties as Node[]) {
    if (property.type === 'ObjectProperty' && propertyKey(property) === name) {
      return property.value as Node;
    }
  }

  return undefined;
}

/** `parameters.docs.description.<kind>`, when it's a string literal. */
export function docsDescription(
  parameters: unknown,
  kind: 'component' | 'story'
): string | undefined {
  const docs = staticPropertyNode(parameters, 'docs');
  const description = staticPropertyNode(docs, 'description');
  const value = staticProperties(description)[kind];

  return typeof value === 'string' ? value : undefined;
}
