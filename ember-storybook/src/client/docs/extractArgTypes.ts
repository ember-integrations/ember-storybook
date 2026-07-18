import emberData from 'virtual:ember-storybook';

import type { ComponentSignature } from '../../node/typedoc/types';

const data = emberData as Record<string, { component?: { file?: string; signatureName?: string }; source?: Record<string, string | undefined>; signatures?: Record<string, ComponentSignature> }>;

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

console.log('[ember-storybook] byName map size:', byName.size);
console.log('[ember-storybook] byName keys:', [...byName.keys()]);

function mapTypeToControl(
  type: string
):
  | false
  | { type: 'text' }
  | { type: 'number' }
  | { type: 'boolean' }
  | { type: 'select'; options: string[] }
  | { type: 'object' }
  | { type: 'date' } {
  const t = type.trim();

  if (t === 'string') return { type: 'text' };
  if (t === 'number') return { type: 'number' };
  if (t === 'boolean') return { type: 'boolean' };
  if (t === 'Date') return { type: 'date' };

  if (t.includes(' | ')) {
    const parts = t.split(' | ').map((s) => s.trim());
    const literals = parts
      .filter((s) => s.startsWith("'") && s.endsWith("'"))
      .map((s) => s.slice(1, -1));

    if (literals.length === parts.length && literals.length > 0) {
      return { type: 'select', options: literals };
    }
  }

  if (t.startsWith('(') && t.includes('=>')) {
    return { type: 'object' };
  }

  if (t.endsWith('[]')) {
    return { type: 'object' };
  }

  return { type: 'object' };
}

function typeSummary(type: string): string {
  if (type.includes(' | ')) {
    const parts = type.split(' | ').map((s) => s.trim());
    const literals = parts.filter((s) => s.startsWith("'") && s.endsWith("'"));

    if (literals.length === parts.length) {
      return literals.map((s) => s.slice(1, -1)).join(' | ');
    }
  }

  return type;
}

export function buildArgTypes(sig: ComponentSignature): Record<string, unknown> {
  const argTypes: Record<string, unknown> = {};

  for (const [name, arg] of Object.entries(sig.args)) {
    argTypes[name] = {
      name,
      description: arg.description || undefined,
      type: {
        name: typeSummary(arg.type),
        required: arg.required
      },
      defaultValue: arg.defaultValue ? { summary: arg.defaultValue } : undefined,
      control: mapTypeToControl(arg.type),
      table: {
        category: 'Args',
        type: { summary: arg.type }
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
