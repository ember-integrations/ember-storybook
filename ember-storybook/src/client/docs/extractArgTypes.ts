import type { ArgTypeInfo, ComponentSignature } from 'ember-docgen';

function mapTypeToControl(
  type: ArgTypeInfo
):
  | false
  | { type: 'text' }
  | { type: 'number' }
  | { type: 'boolean' }
  | { type: 'select'; options: string[] }
  | { type: 'object' }
  | { type: 'function' }
  | { type: 'date' } {
  switch (type.category) {
    case 'string': {
      return { type: 'text' };
    }
    case 'number': {
      return { type: 'number' };
    }
    case 'boolean': {
      return { type: 'boolean' };
    }
    case 'function': {
      return { type: 'function' };
    }
    case 'enum': {
      return { type: 'select', options: type.options ?? [] };
    }

    default: {
      return { type: 'object' };
    }
  }
}

export function buildArgTypes(sig: ComponentSignature): Record<string, unknown> {
  const argTypes: Record<string, unknown> = {};

  for (const [name, arg] of Object.entries(sig.args)) {
    argTypes[name] = {
      name,
      description: arg.description || undefined,
      type: {
        name: arg.type.raw,
        required: arg.required
      },
      control: mapTypeToControl(arg.type),
      table: {
        type: { summary: arg.type.raw },
        defaultValue: arg.defaultValue ? { summary: arg.defaultValue } : undefined
      }
    };
  }

  return argTypes;
}
