import { SourceType } from 'storybook/internal/docs-tools';
import emberData from 'virtual:ember-storybook';

import { buildArgTypes } from './extractArgTypes';
import Page from './page';
import { sourceDecorator } from './source-decorator';

import type { EmberRenderer } from '../types';
import type {
  DecoratorFunction,
  Parameters,
  StoryContextForEnhancers,
  StrictArgTypes
} from 'storybook/internal/types';

const data = emberData as Record<string, { meta?: unknown; component?: { file?: string; signatureName?: string }; source?: Record<string, string | undefined>; signatures?: Record<string, import('../../node/typedoc/types').ComponentSignature> }>;

console.log('[ember-storybook] virtual module data (JS):', data);
console.log('[ember-storybook] virtual module data (JSON):', JSON.stringify(data, null, 2));

function resolveSig(entry: { component?: { file?: string; signatureName?: string }; signatures?: Record<string, import('../../node/typedoc/types').ComponentSignature> }): import('../../node/typedoc/types').ComponentSignature | undefined {
  const comp = entry.component;
  if (!comp?.signatureName) return undefined;

  const compEntry = comp.file ? data[comp.file] : undefined;
  return compEntry?.signatures?.[comp.signatureName];
}

export const argTypesEnhancers: ((
  context: StoryContextForEnhancers<EmberRenderer>
) => StrictArgTypes)[] = [
  (context) => {
    const filePath = (context.parameters as Record<string, unknown>).fileName as string | undefined;

    if (filePath && Object.hasOwn(data, filePath)) {
      const sig = resolveSig(data[filePath]);

      if (sig) {
        return { ...buildArgTypes(sig), ...context.argTypes } as StrictArgTypes;
      }

      return context.argTypes;
    }

    const titleName = context.title.split('/').pop();

    if (titleName) {
      for (const entry of Object.values(data)) {
        if (!entry.component) continue;

        const sig = resolveSig(entry);

        if (sig) {
          return { ...buildArgTypes(sig), ...context.argTypes } as StrictArgTypes;
        }
      }
    }

    return context.argTypes;
  }
];

export const parameters: Parameters = {
  docs: {
    source: {
      type: SourceType.DYNAMIC,
      language: 'html'
    },
    page: Page
  }
};

export const decorators: DecoratorFunction<EmberRenderer>[] = [sourceDecorator];
