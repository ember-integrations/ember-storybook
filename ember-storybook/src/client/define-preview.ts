import { definePreview as definePreviewBase } from 'storybook/internal/csf';

import * as frameworkAnnotations from './config';
import * as docsAnnotations from './docs/annotations';

import type { EmberRenderer } from './types';
import type { TOC } from '@ember/component/template-only';
import type { AddonTypes, InferTypes, Meta, Preview, PreviewAddon } from 'storybook/internal/csf';
import type {
  Args,
  ArgsStoryFn,
  ComponentAnnotations,
  ProjectAnnotations
} from 'storybook/internal/types';

/**
 * The component shapes whose args `preview.meta()` infers from:
 *
 * - template-only components (`TOC<S>` / `TemplateOnlyComponent<S>`)
 * - class components (`Component<S>` — matched through the instance `args`)
 *
 * Anything else (untyped components, plain templates) falls back to loose
 * args; `preview.type<{ args: … }>()` overrides the inference explicitly.
 */
type EmberComponent<TArgs extends Args> =
  TOC<{ Args: TArgs }> | (abstract new (...args: never[]) => { args: Readonly<TArgs> });

type Simplify<T> = { [K in keyof T]: T[K] };

/**
 * The framework's own preview annotations.
 *
 * In CSF Next mode Storybook bypasses the preset `previewAnnotations` entirely
 * (the generated iframe entry uses `preview.composed` alone), so `definePreview`
 * must inject them here — the same way `@storybook/react` folds its
 * `entry-preview` modules into the base factory.
 *
 * `./config` carries the renderer (`render`, `renderToCanvas`), the `renderer:
 * 'ember'` parameter and the outlet global; `./docs/annotations` carries the
 * docgen argTypes enhancers and the source decorator. The addon-docs-dependent
 * pieces (the autodocs `Page`, the patched `DocsRenderer`) are NOT imported
 * here: they arrive through the user's own `addonDocs()` registration, which
 * the preset redirects to `./docs/addon-preview` — keeping `@storybook/addon-docs`
 * out of this module's static import graph.
 */
const internalAnnotations = [frameworkAnnotations, docsAnnotations];

/**
 * The renderer type parameter all `definePreview` factories carry: the Ember
 * renderer merged with whatever types the registered addons contribute.
 *
 * `InferTypes` collapses to `never` when no addons are registered (the empty
 * array case poisons the whole intersection), so it is neutralized here.
 */
export type EmberTypes<Addons extends AddonTypes = AddonTypes> = EmberRenderer & Addons;

type InferAddonTypes<Addons extends PreviewAddon<never>[]> = [InferTypes<Addons>] extends [never]
  ? AddonTypes
  : InferTypes<Addons>;

/**
 * Type-safe preview configuration for Ember (the CSF Next entry point).
 *
 * ```ts
 * // .storybook/preview.ts
 * import { definePreview } from 'ember-storybook';
 * import addonDocs from '@storybook/addon-docs';
 *
 * export default definePreview({
 *   addons: [addonDocs()],
 *   parameters: {
 *     ember: { app: createApp },
 *   },
 * });
 * ```
 */
export function definePreview<Addons extends PreviewAddon<never>[]>(
  input: ProjectAnnotations<EmberTypes<InferAddonTypes<Addons>>> & { addons?: Addons }
): EmberPreview<EmberTypes<InferAddonTypes<Addons>>> {
  return definePreviewBase<EmberTypes<InferAddonTypes<Addons>>, Addons>({
    ...input,
    // After the user's addons so framework values (argTypes enhancers, the
    // source decorator, the renderer itself) win the merge — mirroring the
    // CSF3 order, where the preset appends them last.
    addons: [...(input.addons ?? []), ...internalAnnotations] as unknown as Addons
  }) as unknown as EmberPreview<EmberTypes<InferAddonTypes<Addons>>>;
}

/**
 * The CSF Next `Preview` specialized for Ember: `preview.meta()` infers story
 * args from the component's signature.
 */
export interface EmberPreview<TRenderer extends EmberRenderer> extends Omit<
  Preview<TRenderer>,
  'meta' | 'type'
> {
  /**
   * Narrows or extends the inferred annotation types, e.g. to add args that
   * the component signature cannot provide:
   *
   * ```ts
   * const meta = preview.type<{ args: { theme: 'light' | 'dark' } }>().meta({
   *   component: Button,
   * });
   * ```
   */
  type<R>(): EmberPreview<TRenderer & R>;

  /**
   * Creates the component meta for a story file; `meta.story()` then requires
   * exactly the component's args.
   *
   * ```ts
   * const meta = preview.meta({ component: Button });
   * export const Primary = meta.story({ args: { label: 'Click me' } });
   * ```
   */
  meta<TArgs extends Args, TInput extends ComponentAnnotations<TRenderer & { args: TArgs }, TArgs>>(
    input: TInput & {
      component?: EmberComponent<TArgs>;
      render?: ArgsStoryFn<TRenderer & { args: TArgs }, TArgs>;
    }
  ): Meta<TRenderer & { args: Simplify<TArgs & NonNullable<TInput['args']>> }, TInput>;

  meta<TInput extends ComponentAnnotations<TRenderer, TRenderer['args']>>(
    input: TInput
  ): Meta<TRenderer, TInput>;
}
