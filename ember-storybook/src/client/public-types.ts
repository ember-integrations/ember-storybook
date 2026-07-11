import type { EmberRenderer } from './types';
import type {
  AnnotatedStoryFn,
  Args,
  ComponentAnnotations,
  DecoratorFunction,
  LoaderFunction,
  ProjectAnnotations,
  StoryAnnotations,
  StoryContext as GenericStoryContext,
  StrictArgs
} from 'storybook/internal/types';

export type { Args, ArgTypes, Parameters, StrictArgs } from 'storybook/internal/types';

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/api/csf#default-export)
 */
export type Meta<TArgs = Args> = ComponentAnnotations<EmberRenderer, TArgs>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/api/csf#named-story-exports)
 */
export type StoryFn<TArgs = Args> = AnnotatedStoryFn<EmberRenderer, TArgs>;

/**
 * Story object that represents a CSFv3 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/api/csf#named-story-exports)
 */
export type StoryObj<TArgs = Args> = StoryAnnotations<EmberRenderer, TArgs>;

export type Decorator<TArgs = StrictArgs> = DecoratorFunction<EmberRenderer, TArgs>;
export type Loader<TArgs = StrictArgs> = LoaderFunction<EmberRenderer, TArgs>;
export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<EmberRenderer, TArgs>;
export type Preview = ProjectAnnotations<EmberRenderer>;

export { type EmberRenderer } from './types';
