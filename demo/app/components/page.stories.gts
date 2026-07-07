import type { Meta, StoryObj } from 'ember-storybook';

import { expect, userEvent, within } from 'storybook/test';

import Page from './page.gts';
import Service from '@ember/service';

const meta = {
  title: 'Example/Page',
  component: Page,
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;

export const LoggedOut: StoryObj = {};

// More on component testing: https://storybook.js.org/docs/writing-tests/interaction-testing
export const LoggedIn: StoryObj = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const loginButton = canvas.getByRole('button', { name: /Log in/i });
    await expect(loginButton).toBeInTheDocument();
    await userEvent.click(loginButton);
    await expect(loginButton).not.toBeInTheDocument();

    const logoutButton = canvas.getByRole('button', { name: /Log out/i });
    await expect(logoutButton).toBeInTheDocument();
  },
};

export const Japanese: StoryObj = {
  parameters: {
    ember: {
      owner: {
        'service:intl': class JaIntl extends Service {
          t = (key: string) => {
            const map = {
              'welcome': 'こんにちは',
              'actions.login': 'ログイン',
              'actions.logout': 'ログアウト',
              'actions.signup': 'サインアップ'
            };

            // @ts-ignore
            return map[key];
          }
        }
      }
    }
  }
}