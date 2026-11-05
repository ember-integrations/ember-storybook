// Template source for "Show code" and the components manifest. Pure, so the
// node side can use it as well as the docs decorator.
import { unwrapBlockParamsShallow } from './block-params';

import type { BlockInfo, ComponentSignature } from 'ember-docgen';
import type { Args, ArgTypes } from 'storybook/internal/types';

export function toArgument(key: string, value: unknown, argTypes: ArgTypes): string | undefined {
  if (value !== undefined && value !== null) {
    if (typeof value === 'string') {
      return `@${key}=${JSON.stringify(value)}`;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return `@${key}={{${String(value)}}}`;
    }

    if (Object.hasOwn(argTypes, key)) {
      return `@${key}={{@${key}}}`;
    }

    return undefined;
  }

  if (value === undefined && Object.hasOwn(argTypes, key)) {
    return `@${key}={{@${key}}}`;
  }

  return undefined;
}

function generateBlockContent(blockInfo: BlockInfo): string {
  if (blockInfo.params.length === 0) {
    return '...';
  }

  const paramNames = unwrapBlockParamsShallow(blockInfo.params)
    .map((p) => p.name)
    .join(', ');

  return `{{yield ${paramNames}}}`;
}

export function generateBlockSourceCode(
  sig: ComponentSignature,
  args: Args,
  indent: string
): string {
  const blockNames = Object.keys(sig.blocks);

  if (blockNames.length === 0) return '';

  const blocks: string[] = [];

  for (const blockName of blockNames) {
    const blockInfo = sig.blocks[blockName];
    const arg = (args as Record<string, unknown>)[blockName];

    if (arg === undefined && blockInfo.params.length === 0) {
      continue;
    }

    const params = unwrapBlockParamsShallow(blockInfo.params)
      .map((p) => p.name)
      .join(' ');
    const slotBindings = params ? ` as |${params}|` : '';

    const content = generateBlockContent(blockInfo);

    if (blockName === 'default' && !slotBindings) {
      blocks.push(content);
    } else {
      blocks.push(`${indent}  <:${blockName}${slotBindings}>${content}</:${blockName}>`);
    }
  }

  return blocks.join('\n');
}

/**
 * Fill a story template's `{{args.name}}` with the story's values: as an
 * attribute or argument value (`@name="Ada"`) or as text (`Hello, Ada`).
 */
export function resolveTemplateArgs(template: string, args: Args): string {
  return template.replaceAll(
    /(=)?\{\{args\.(\w+)\}\}/g,
    (_match, assign: string | undefined, key: string) => {
      const value = (args as Record<string, unknown>)[key];

      if (typeof value === 'string') {
        return assign ? `=${JSON.stringify(value)}` : value;
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return assign ? `={{${String(value)}}}` : String(value);
      }

      return `${assign ?? ''}{{@${key}}}`;
    }
  );
}

/** An invocation of the component with the given args, for a story without its own template. */
export function componentSource(
  name: string,
  sig: ComponentSignature | undefined,
  args: Args,
  argTypes: ArgTypes
): string {
  const propsArray = Object.entries(args)
    .filter(([k]) => !sig || !Object.hasOwn(sig.blocks, k))
    .map(([k, v]) => toArgument(k, v, argTypes))
    .filter(Boolean);

  const blockCode = sig ? generateBlockSourceCode(sig, args, '') : '';

  const propsStr = propsArray.join(' ');

  if (!blockCode) {
    if (propsArray.length === 0) {
      return `<${name} />`;
    }

    if (propsArray.length > 3) {
      return `<${name}\n  ${propsArray.join('\n  ')}\n/>`;
    }

    return `<${name} ${propsStr} />`;
  }

  if (propsArray.length === 0) {
    return `<${name}>\n${blockCode}\n</${name}>`;
  }

  return `<${name} ${propsStr}>\n${blockCode}\n</${name}>`;
}
