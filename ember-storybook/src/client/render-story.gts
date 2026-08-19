import Component from '@glimmer/component';
import { getOwner } from '@ember/owner';
import { renderComponent } from '@ember/renderer';

import { modifier } from 'ember-modifier';

import { normalizeStoryResult } from './story-result';

interface RenderStorySignature {
  Args: {
    story: () => object;
    args: Record<string, unknown>;
  };
  Element: HTMLDivElement;
}

export class RenderStory extends Component<RenderStorySignature> {
  render = modifier((element: HTMLDivElement) => {
    const story = this.args.story();
    const { component, args } = normalizeStoryResult(story, this.args.args);
    const owner = getOwner(this);
    const result = renderComponent(component, {
      args,
      into: element,
      owner
    });

    return () => {
      result.destroy();
    };
  });

  <template>
    <div {{this.render}}></div>
  </template>
}
