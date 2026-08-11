import { SourceType } from 'storybook/internal/docs-tools';
import emberData from 'virtual:ember-storybook';

import { buildArgTypes } from './extractArgTypes';
import Page from './page';
import { sourceDecorator } from './source-decorator';

import type { ComponentFile, EmberMeta, StoryFile } from '../../node/types';
import type { EmberRenderer } from '../types';
import type { ComponentSignature } from 'ember-docgen';
import type {
  DecoratorFunction,
  Parameters,
  StoryContextForEnhancers,
  StrictArgTypes
} from 'storybook/internal/types';

const data = emberData as EmberMeta;

function resolveSig(entry: StoryFile | ComponentFile): ComponentSignature | undefined {
  if (!('component' in entry)) return undefined;

  const comp = entry.component;

  if (!comp.signatureName) return undefined;

  const compEntry = comp.file ? data[comp.file] : undefined;

  if (!compEntry || !('signatures' in compEntry)) return undefined;

  return compEntry.signatures[comp.signatureName];
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
