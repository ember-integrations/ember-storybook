import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    /** Value the counter starts at. */
    initialCount?: number;
  };
}

/**
 * Stateful playground for the Interaction Recorder: a click, a typed input,
 * and a checkbox that reveals a dependent block. Every piece of state is
 * `@tracked` on the component instance, so a remount resets it — which is
 * exactly what the recorder must not cause while it records.
 */
export default class InteractionDemo extends Component<Signature> {
  @tracked count = this.args.initialCount ?? 0;
  @tracked name = '';
  @tracked notify = false;

  increment = (): void => {
    this.count += 1;
  };

  updateName = (event: Event): void => {
    this.name = (event.target as HTMLInputElement).value;
  };

  toggleNotify = (): void => {
    this.notify = !this.notify;
  };

  <template>
    <div ...attributes>
      <p>Count: <output>{{this.count}}</output></p>

      <button id="interaction-demo-increment" type="button" {{on "click" this.increment}}>
        Increment
      </button>

      <label for="interaction-demo-name">Name</label>
      <input
        id="interaction-demo-name"
        type="text"
        value={{this.name}}
        {{on "input" this.updateName}}
      />

      <label>
        <input type="checkbox" checked={{this.notify}} {{on "change" this.toggleNotify}} />
        Send notifications
      </label>

      {{#if this.notify}}
        <p>Notifications for {{this.name}} (count: {{this.count}}).</p>
      {{/if}}
    </div>
  </template>
}
