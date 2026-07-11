import type Application from '@ember/application';
import type ApplicationInstance from '@ember/application/instance';
import type { StoryContext as DefaultStoryContext, WebRenderer } from 'storybook/internal/types';

export type { RenderContext } from 'storybook/internal/types';

export interface ShowErrorArgs {
  title: string;
  description: string;
}

export type AppParamater =
  | typeof Application
  | ApplicationInstance
  | ((options?: Record<string, unknown>) => typeof Application | ApplicationInstance);

export interface EmberParameters {
  // renderer: 'ember';
  ember?: {
    app?: AppParamater;
    owner?: Record<`${string}:${string}`, object>;
  };
}

export interface EmberRenderer extends WebRenderer {
  // We are omitting props, as we don't use it internally, and more importantly, it completely changes the assignability of meta.component.
  // Try not omitting, and check the type errros in the test file, if you want to learn more.
  component: object;
  storyResult: object; // ComponentLike
  csf4: true;
  parameters: EmberParameters;
}

export type StoryContext = DefaultStoryContext<EmberRenderer> & {
  parameters: DefaultStoryContext<EmberRenderer>['parameters'] & EmberParameters;
};
