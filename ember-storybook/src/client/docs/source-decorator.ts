import { SourceType } from 'storybook/internal/docs-tools';
import { emitTransformCode, useEffect, useRef } from 'storybook/preview-api';
import emberData from 'virtual:ember-storybook';

import { isEmberStoryResult } from '../story-result';
import { componentSource, resolveTemplateArgs } from './source-code';

import type { StorySource } from '../../node/types';
import type { StoryFn } from '../public-types';
import type { EmberRenderer } from '../types';
import type { ComponentSignature } from 'ember-docgen';
import type { Args, ArgTypes, DecoratorFunction } from 'storybook/internal/types';

export { resolveTemplateArgs, toArgument } from './source-code';

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

let byStoryId: Record<string, StorySource> | undefined;

function getByStoryId(): Record<string, StorySource> {
  if (byStoryId) return byStoryId;

  byStoryId = {};

  for (const entry of Object.values(data)) {
    for (const [storyId, source] of Object.entries(entry.source ?? {})) {
      byStoryId[storyId] = {
        componentName: source.componentName,
        signatureName: source.signatureName,
        inlineTemplate: source.inlineTemplate
      };
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

  // Default-exported components are keyed by the `__DEFAULT__` sentinel in the
  // signatures map, while `name` is the real component name. Look the signature
  // up by the sentinel so blocks/args still resolve.
  const sig = signatureForComponent(meta?.signatureName ?? name);

  return componentSource(name, sig, args, argTypes);
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
