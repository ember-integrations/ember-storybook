import { SourceType } from 'storybook/internal/docs-tools';
import { emitTransformCode, useEffect, useRef } from 'storybook/preview-api';

import type { StoryFn } from '../public-types';
import type { EmberRenderer } from '../types';
import type { Args, ArgTypes, DecoratorFunction } from 'storybook/internal/types';

function skipSourceRender(context: Parameters<DecoratorFunction<EmberRenderer>>[1]) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const sourceParams = context.parameters.docs?.source;

  // always render if the user forces it
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (sourceParams?.type === SourceType.DYNAMIC) {
    return false;
  }

  const isArgsStory = context.parameters.__isArgsStory as boolean;

  // never render if the user is forcing the block to render code, or
  // if the user provides code, or if it's not an args story.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  return (!isArgsStory || sourceParams?.code) ?? sourceParams?.type === SourceType.CODE;
}

function toArgument(key: string, value: unknown, argTypes: ArgTypes): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const argType = argTypes[key];

  // event should be skipped
  if (argType.action) {
    return undefined;
  }

  if (typeof value === 'string') {
    return `@${key}=${JSON.stringify(value)}`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return `@${key}={{${JSON.stringify(value)}}}`;
  }

  return undefined;
}

export function generateGlimmerSource(
  component: object & { name?: string },
  args: Args,
  argTypes: ArgTypes
): string | undefined {
  const name = component.name;

  if (!name) {
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
        generateGlimmerSource(renderedForSource, context.args, context.argTypes) ?? undefined;

      void emitTransformCode(code, context);
      source.current = code;
    }
  });

  return story;
};
