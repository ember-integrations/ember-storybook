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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Merges signature-derived argTypes with the story-provided argTypes.
 *
 * Signature argTypes are the base; story argTypes enhance them for better
 * rendering (custom `name`, `control`, `options`, ...). For args present in
 * both, story fields win — but only when they carry an actual value, so an
 * explicit `undefined` never masks a signature field. The signature keeps the
 * `type`, `table` and `description` the story does not override.
 */
export function mergeArgTypes(
  signatureArgTypes: Record<string, unknown>,
  storyArgTypes: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...signatureArgTypes };

  for (const [name, storyArg] of Object.entries(storyArgTypes)) {
    if (storyArg === undefined) continue;

    const sigArg = merged[name];

    if (!isObject(sigArg) || !isObject(storyArg)) {
      merged[name] = storyArg;
      continue;
    }

    const storyFields = Object.fromEntries(
      Object.entries(storyArg).filter(([, value]) => value !== undefined)
    );

    merged[name] = { ...sigArg, ...storyFields };
  }

  return merged;
}

/**
 * Whether the docs page should render the Args/controls table: either the
 * component signature exposes args, or the meta carries story-provided
 * argTypes (e.g. for a template-only component with story argTypes but no
 * signature args).
 */
export function shouldShowArgsSection(
  sig: ComponentSignature,
  metaArgTypes?: Record<string, unknown>
): boolean {
  return Object.keys(sig.args).length > 0 || Object.keys(metaArgTypes ?? {}).length > 0;
}
