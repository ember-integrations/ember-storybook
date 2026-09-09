import type { TOC } from '@ember/component/template-only';

interface GreetingSignature {
  Element: HTMLDivElement;
  Args: {
    name: string;
  };
}

const Greeting: TOC<GreetingSignature> = <template>
  <div ...attributes>
    Hello
    {{@name}}
  </div>
</template>;

export { Greeting };
