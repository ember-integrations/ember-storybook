import emberData from 'virtual:ember-storybook';

import type { StorySource } from '../../node/types';
import type { ArgTypeInfo, ComponentSignature } from 'ember-docgen';

const data = emberData as Record<
  string,
  {
    component?: { file?: string; signatureName?: string };
    source?: Record<string, StorySource>;
    signatures?: Record<string, ComponentSignature>;
  }
>;

const byName = new Map<string, ComponentSignature>();

for (const entry of Object.values(data)) {
  const comp = entry.component;

  if (!comp?.signatureName) continue;

  const compEntry = comp.file ? data[comp.file] : undefined;
  const sig = compEntry?.signatures?.[comp.signatureName];

  if (sig) {
    byName.set(comp.signatureName, sig);
  }
}

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

export function extractArgTypes(
  component: Record<string, unknown>
): Record<string, unknown> | null {
  const name =
    (component.name as string | undefined) ?? (component.displayName as string | undefined);

  // eslint-disable-next-line unicorn/no-null
  if (!name) return null;

  const sig = byName.get(name);

  // eslint-disable-next-line unicorn/no-null
  if (!sig) return null;

  return buildArgTypes(sig);
}
