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
    const { component, args, route } = normalizeStoryResult(story, this.args.args);
    const owner = getOwner(this);

    if (route) {
      // `{{outlet}}` is resolved from Glimmer's dynamic scope, which only a root
      // render can seed. Rendering it in here would nest a second outlet root
      // inside an already-rendering tree, so route stories are canvas-only.
      throw new Error(
        'ember-storybook: this story sets `parameters.ember.route`, but route stories ' +
          'can only be rendered by `renderToCanvas`, not through <RenderStory> ' +
          '(portable stories).'
      );
    }

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
