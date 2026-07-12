import { SourceType } from 'storybook/internal/docs-tools';
import { emitTransformCode, useEffect, useRef } from 'storybook/preview-api';
import storyMeta from 'virtual:ember-storybook-meta';

import type { StoryFn } from '../public-types';
import type { EmberRenderer } from '../types';
import type { Args, ArgTypes, DecoratorFunction } from 'storybook/internal/types';

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
      return `@${key}={{${JSON.stringify(value)}}}`;
    }
  }

  if (Object.hasOwn(argTypes, key)) {
    return `@${key}={{@${key}}}`;
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
  component: object & { name?: string },
  args: Args,
  argTypes: ArgTypes,
  storyId?: string
): string | undefined {
  const meta = storyId
    ? (storyMeta as Record<string, { componentName: string; inlineTemplate?: string }>)[storyId]
    : undefined;

  if (meta?.inlineTemplate) {
    return resolveTemplateArgs(meta.inlineTemplate, args);
  }

  const name = meta?.componentName ?? component.name;

  if (!name || name === '(unknown template-only component)') {
    return undefined;
  }

  const propsArray = Object.entries(args)
    .map(([k, v]) => toArgument(k, v, argTypes))
    .filter(Boolean);

  if (propsArray.length === 0) {
    return `<${name} />`;
  }

  if (propsArray.length > 3) {
    return `<${name}\n  ${propsArray.join('\n  ')}\n/>`;
  }

  return `<${name} ${propsArray.join(' ')} />`;
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
