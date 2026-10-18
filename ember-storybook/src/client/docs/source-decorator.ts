import { SourceType } from 'storybook/internal/docs-tools';
import { emitTransformCode, useEffect, useRef } from 'storybook/preview-api';
import emberData from 'virtual:ember-storybook';

import { isEmberStoryResult } from '../story-result';
import { unwrapBlockParamsShallow } from './block-params';

import type { StorySource } from '../../node/types';
import type { StoryFn } from '../public-types';
import type { EmberRenderer } from '../types';
import type { BlockInfo, ComponentSignature } from 'ember-docgen';
import type { Args, ArgTypes, DecoratorFunction } from 'storybook/internal/types';

const data = emberData as Record<
  string,
  {
    component?: { file?: string; signatureName?: string };
    source?: Record<string, StorySource>;
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

type StoryLookup = StorySource & { componentFile?: string };

let byStoryId: Record<string, StoryLookup> | undefined;

function getByStoryId(): Record<string, StoryLookup> {
  if (byStoryId) return byStoryId;

  byStoryId = {};

  for (const entry of Object.values(data)) {
    for (const [storyId, source] of Object.entries(entry.source ?? {})) {
      byStoryId[storyId] = {
        componentName: source.componentName,
        signatureName: source.signatureName,
        inlineTemplate: source.inlineTemplate,
        componentFile: entry.component?.file
      };
    }
  }

  return byStoryId;
}

/**
 * The signature of the component a story renders, from that component's own
 * file: every default export has the same `__DEFAULT__` signature name.
 */
function signatureForStory(
  story: StoryLookup | undefined,
  name: string
): ComponentSignature | undefined {
  const file = story?.componentFile;

  if (!file || !Object.hasOwn(data, file)) return undefined;

  return data[file].signatures?.[story.signatureName ?? name];
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

  const sig = signatureForStory(meta, name);

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
    // Always generate the source from the ORIGINAL story, not the decorator-wrapped
    // `storyFn()` result. A decorator wraps the story in another component, so its
    // `.name` (e.g. `IntlDecorator`) would leak into the generated source block.
    const rendered = (context.originalStoryFn as StoryFn)(context.args, context);
    const renderedForSource = isEmberStoryResult(rendered) ? rendered.component : rendered;

    if (!skipSourceRender(context)) {
      const code =
        generateSource(renderedForSource, context.args, context.argTypes, context.id) ?? undefined;

      void emitTransformCode(code, context);
      source.current = code;
    }
  });

  return story;
};
