import { SourceType } from 'storybook/internal/docs-tools';
import { emitTransformCode, useEffect, useRef } from 'storybook/preview-api';
import emberData from 'virtual:ember-storybook';

import { unwrapBlockParams } from './block-params';

import type { StoryFn } from '../public-types';
import type { EmberRenderer } from '../types';
import type { BlockInfo, ComponentSignature } from 'ember-docgen';
import type { Args, ArgTypes, DecoratorFunction } from 'storybook/internal/types';

const data = emberData as Record<
  string,
  {
    component?: { file?: string; signatureName?: string };
    source?: Record<string, string | undefined>;
    signatures?: Record<string, ComponentSignature>;
  }
>;

function skipSourceRender(context: Parameters<DecoratorFunction<EmberRenderer>>[1]) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const sourceParams = context.parameters.docs?.source;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (sourceParams?.type === SourceType.DYNAMIC) {
    return false;
  }

  const isArgsStory = context.parameters.__isArgsStory as boolean;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  return (!isArgsStory || sourceParams?.code) ?? sourceParams?.type === SourceType.CODE;
}

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

  const paramNames = unwrapBlockParams(blockInfo.params)
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

    const params = unwrapBlockParams(blockInfo.params)
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

let byStoryId: Record<string, { componentName?: string; inlineTemplate?: string }> | undefined;

function getByStoryId(): Record<string, { componentName?: string; inlineTemplate?: string }> {
  if (byStoryId) return byStoryId;

  byStoryId = {};

  for (const entry of Object.values(data)) {
    const comp = entry.component;

    if (!comp) continue;

    for (const [storyId, inlineTemplate] of Object.entries(entry.source ?? {})) {
      byStoryId[storyId] = { componentName: comp.signatureName, inlineTemplate };
    }
  }

  return byStoryId;
}

function signatureForComponent(name: string): ComponentSignature | undefined {
  for (const entry of Object.values(data)) {
    const comp = entry.component;

    if (comp?.signatureName !== name) continue;

    const compEntry = comp.file ? data[comp.file] : undefined;

    return compEntry?.signatures?.[comp.signatureName];
  }

  return undefined;
}

export function resolveTemplateArgs(template: string, args: Args): string {
  return template.replaceAll(/\{\{args\.(\w+)\}\}/g, (_match, key) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const value = (args as Record<string, unknown>)[key];

    if (typeof value === 'string') {
      return JSON.stringify(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return `{{${String(value)}}}`;
    }

    return `{{@${key}}}`;
  });
}

export function generateSource(
  component: { name?: string },
  args: Args,
  argTypes: ArgTypes,
  storyId?: string
): string | undefined {
  const meta = storyId ? getByStoryId()[storyId] : undefined;

  if (meta?.inlineTemplate) {
    return resolveTemplateArgs(meta.inlineTemplate, args);
  }

  const name = meta?.componentName ?? component.name;

  if (!name || name === '(unknown template-only component)') {
    return undefined;
  }

  const sig = signatureForComponent(name);

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

export const sourceDecorator: DecoratorFunction<EmberRenderer> = (storyFn, context) => {
  const source = useRef<string | undefined>(undefined);
  const story = storyFn();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const renderedForSource = context.parameters.docs?.source?.excludeDecorators
      ? (context.originalStoryFn as StoryFn)(context.args, context)
      : story;

    if (!skipSourceRender(context)) {
      const code =
        generateSource(renderedForSource, context.args, context.argTypes, context.id) ?? undefined;

      void emitTransformCode(code, context);
      source.current = code;
    }
  });

  return story;
};
