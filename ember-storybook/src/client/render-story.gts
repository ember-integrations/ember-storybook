import Component from '@glimmer/component';
import { getOwner } from '@ember/owner';
import { renderComponent } from '@ember/renderer';

import { modifier } from 'ember-modifier';

import { templateUsesOutlet } from './outlet';
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

    if (route || templateUsesOutlet(component)) {
      // Route stories are canvas-only: `renderToCanvas` owns the outlet backend
      // (outlet root on classic builds, the `@outlet` argument on RFC 1099),
      // while nesting this render inside a live tree would seed it without
      // route parameters or the outlet global.
      throw new Error(
        'ember-storybook: this story renders a route template (it uses `{{outlet}}`), ' +
          'but route stories can only be rendered by `renderToCanvas`, not through ' +
          '<RenderStory> (portable stories).'
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
