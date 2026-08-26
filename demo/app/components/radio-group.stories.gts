import { RadioGroup } from './radio-group.gts';

export default {
  title: 'RadioGroup',
  component: RadioGroup,
  args: { value: 'banana' }
};

export const Demo = {
  render: () => <template>
    <RadioGroup as |rg|>
      <rg.Button @value="banana">Banana</rg.Button>
      <rg.IconButton @value="apple">Apple</rg.IconButton>
    </RadioGroup>
  </template>
};
