import { SourceType } from 'storybook/internal/docs-tools';

import { sourceDecorator } from './source-decorator';

import type { EmberRenderer } from '../types';
import type { DecoratorFunction, Parameters } from 'storybook/internal/types';

export const parameters: Parameters = {
  docs: {
    source: {
      type: SourceType.DYNAMIC,
      language: 'html'
    }
  }
};

export const decorators: DecoratorFunction<EmberRenderer>[] = [sourceDecorator];
