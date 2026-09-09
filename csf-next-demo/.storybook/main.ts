import { defineMain } from 'ember-storybook/node';

export default defineMain({
  stories: ['../**/*.stories.g(j|t)s'],

  addons: ['@storybook/addon-docs', '@storybook/addon-vitest'],

  framework: {
    name: 'ember-storybook',
    options: {}
  },

  core: {
    disableWhatsNewNotifications: true
  }
});
