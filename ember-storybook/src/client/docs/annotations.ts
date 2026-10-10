import { SourceType } from 'storybook/internal/docs-tools';
import emberData from 'virtual:ember-storybook';

import { buildArgTypes, mergeArgTypes } from './extractArgTypes';
import { sourceDecorator } from './source-decorator';

import type { ComponentFile, ComponentReference, EmberMeta, StoryFile } from '../../node/types';
import type { EmberRenderer } from '../types';
import type { ComponentSignature } from 'ember-docgen';
import type {
  DecoratorFunction,
  Parameters,
  StoryContextForEnhancers,
  StrictArgTypes
} from 'storybook/internal/types';

const data = emberData as EmberMeta;

function signatureFor(ref: ComponentReference | undefined): ComponentSignature | undefined {
  if (!ref?.signatureName) return undefined;

  const compEntry = ref.file ? data[ref.file] : undefined;

  if (!compEntry || !('signatures' in compEntry)) return undefined;

  return compEntry.signatures[ref.signatureName];
}

function resolveSig(entry: StoryFile | ComponentFile): ComponentSignature | undefined {
  if (!('component' in entry)) return undefined;

  return signatureFor(entry.component);
}

/**
 * With `subcomponents`, the `Controls` block shows the main component as a tab
 * too, labelled `__docgenInfo.displayName ?? component.name`. A production
 * build minifies class names, so the tab would read e.g. `Pe`; label it with
 * the name the story file uses instead.
 */
function nameMainComponent(component: unknown, displayName: string | undefined) {
  if (!displayName || (typeof component !== 'object' && typeof component !== 'function')) return;
  if (component === null || Object.hasOwn(component, '__docgenInfo')) return;

  Object.defineProperty(component, '__docgenInfo', {
    value: { displayName },
    configurable: true
  });
}

/**
 * The signatures of the components listed in a meta's CSF `subcomponents`,
 * keyed by the component itself — the only handle Storybook passes to
 * `parameters.docs.extractArgTypes`.
 */
const subcomponentSignatures = new WeakMap<object, ComponentSignature>();

function registerSubcomponents(
  context: StoryContextForEnhancers<EmberRenderer>,
  entry: StoryFile | ComponentFile
) {
  if (!('component' in entry) || !entry.subcomponents) return;

  for (const [key, component] of Object.entries(context.subcomponents ?? {})) {
    const sig = signatureFor(entry.subcomponents[key]);

    if (sig && (typeof component === 'object' || typeof component === 'function')) {
      subcomponentSignatures.set(component, sig);
    }
  }

  nameMainComponent(context.component, entry.meta.component);
}

/**
 * Storybook's `Controls` / `ArgTypes` blocks build the tab of each CSF
 * `subcomponents` entry through `parameters.docs.extractArgTypes`, and throw
 * ("Args unsupported") when the framework doesn't provide it.
 *
 * Returns the args of a subcomponent registered by the argTypes enhancer, and
 * no args (an empty tab) for anything else, e.g. a component whose signature
 * could not be extracted.
 */
export function extractArgTypes(component: unknown): StrictArgTypes {
  const sig =
    component && (typeof component === 'object' || typeof component === 'function')
      ? subcomponentSignatures.get(component)
      : undefined;

  return sig ? (buildArgTypes(sig) as StrictArgTypes) : {};
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
      registerSubcomponents(context, data[filePath]);

      const sig = resolveSig(data[filePath]);

      if (sig) {
        return mergeArgTypes(buildArgTypes(sig), context.argTypes) as StrictArgTypes;
      }

      return context.argTypes;
    }

    // No `parameters.fileName` — fall back to matching the CSF title leaf
    // against indexed story files instead of picking an arbitrary signature.
    const leaf = titleLeaf(context.title);

    if (leaf) {
      for (const entry of Object.values(data)) {
        if (!('meta' in entry)) continue;

        if (titleLeaf(entry.meta.title) !== leaf) continue;

        registerSubcomponents(context, entry);

        const sig = resolveSig(entry);

        if (sig) {
          return mergeArgTypes(buildArgTypes(sig), context.argTypes) as StrictArgTypes;
        }
      }
    }

    return context.argTypes;
  }
];

export const parameters: Parameters = {
  docs: {
    extractArgTypes,
    source: {
      type: SourceType.DYNAMIC,
      language: 'html'
    }
  }
};

export const decorators: DecoratorFunction<EmberRenderer>[] = [sourceDecorator];
