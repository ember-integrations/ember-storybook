import { SourceType } from 'storybook/internal/docs-tools';
import emberData from 'virtual:ember-storybook';

import { buildArgTypes, mergeArgTypes, sortArgTypes } from './extractArgTypes';
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

/** Last path segment of a CSF title — used to match stories without `fileName`. */
function titleLeaf(title: string | undefined): string | undefined {
  return title?.split('/').pop();
}

export const argTypesEnhancers: ((
  context: StoryContextForEnhancers<EmberRenderer>
) => StrictArgTypes)[] = [
  (context) => {
    const filePath = (context.parameters as Record<string, unknown>).fileName as string | undefined;

    if (filePath && Object.hasOwn(data, filePath)) {
      const sig = resolveSig(data[filePath]);

      if (sig) {
        return sortArgTypes(mergeArgTypes(buildArgTypes(sig), context.argTypes)) as StrictArgTypes;
      }

      return sortArgTypes(context.argTypes) as StrictArgTypes;
    }

    // No `parameters.fileName` — fall back to matching the CSF title leaf
    // against indexed story files instead of picking an arbitrary signature.
    const leaf = titleLeaf(context.title);

    if (leaf) {
      for (const entry of Object.values(data)) {
        if (!('meta' in entry)) continue;

        if (titleLeaf(entry.meta.title) !== leaf) continue;

        const sig = resolveSig(entry);

        if (sig) {
          return sortArgTypes(
            mergeArgTypes(buildArgTypes(sig), context.argTypes)
          ) as StrictArgTypes;
        }
      }
    }

    return sortArgTypes(context.argTypes) as StrictArgTypes;
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
