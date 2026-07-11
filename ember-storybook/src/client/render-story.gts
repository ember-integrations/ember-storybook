import { renderComponent } from '@ember/renderer';
import { getOwner } from '@ember/owner';
import Component from '@glimmer/component';
import { modifier } from 'ember-modifier';

interface RenderStorySignature {
  Args: {
    story: () => object;
    args: Record<string, unknown>;
  };
  Element: HTMLDivElement;
}

export class RenderStory extends Component<RenderStorySignature> {
  render = modifier((element: HTMLDivElement) => {
    const component = this.args.story();
    const owner = getOwner(this);
    const result = renderComponent(component, {
      args: this.args.args,
      into: element,
      owner,
    });

    return () => {
      result.destroy();
    }
  });

  <template>
    <div {{this.render}}></div>
  </template>
}