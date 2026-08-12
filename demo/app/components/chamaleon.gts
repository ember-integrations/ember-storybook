import { element } from 'ember-element-helper';

const Chamaleon = <template>
  {{#let (element "span") as |Elem|}}
    <Elem>
      span or div?
    </Elem>
  {{/let}}
</template>;

export { Chamaleon };
