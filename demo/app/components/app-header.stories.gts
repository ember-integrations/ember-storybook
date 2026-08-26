import { AppHeader } from './app-header.gts';

export default {
  title: 'AppHeader',
  component: AppHeader
};

export const Demo = {
  render: () => <template>
    <AppHeader>
      <:nav as |nav|>
        <nav.Item @label="Home" />
      </:nav>
      <:aux as |aux|>
        <aux.Item @label="Search" />
      </:aux>
    </AppHeader>
  </template>
};