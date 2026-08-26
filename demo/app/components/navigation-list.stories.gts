import { NavigationList } from './navigation-list.gts';

export default {
  title: 'NavigationList',
  component: NavigationList
};

export const Demo = {
  render: () => <template>
    <NavigationList as |nl|>
      <nl.Item>Home</nl.Item>
      <nl.Title>Menu</nl.Title>
    </NavigationList>
  </template>
};
