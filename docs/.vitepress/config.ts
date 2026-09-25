import { defineConfig } from "vitepress";
import { groupIconMdPlugin, groupIconVitePlugin } from "vitepress-plugin-group-icons";
import { tabsMarkdownPlugin } from "vitepress-plugin-tabs";
import { csfTabsPlugin } from "./csfTabs";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "en-US",
  title: "ember-storybook",
  description: "Storybook for Ember: develop, document, and test UI components in isolation.",
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ["adrs/**"],

  markdown: {
    config(md) {
      md.use(csfTabsPlugin);
      md.use(tabsMarkdownPlugin);
      md.use(groupIconMdPlugin);
    },
  },

  vite: {
    plugins: [
      groupIconVitePlugin({
        defaultLabels: ["npm", "yarn", "pnpm", "bun", "deno"],
      }),
    ],
  },

  themeConfig: {
    nav: [
      { text: "Getting Started", link: "/getting-started" },
      { text: "Guide", link: "/guide/writing-stories", activeMatch: "/guide/" },
      { text: "Configuration", link: "/configuration/main-ts", activeMatch: "/configuration/" },
    ],

    outline: [2, 3],

    sidebar: [
      {
        text: "Getting Started",
        items: [{ text: "Install & First Story", link: "/getting-started" }],
      },
      {
        text: "Guide",
        items: [
          { text: "Writing Stories", link: "/guide/writing-stories" },
          { text: "Decorators", link: "/guide/decorators" },
          { text: "Route Stories", link: "/guide/route-stories" },
          { text: "App Context & Globals", link: "/guide/context-and-globals" },
          { text: "Auto-Docs", link: "/guide/auto-docs" },
          { text: "Testing", link: "/guide/testing" },
        ],
      },
      {
        text: "Configuration",
        items: [
          { text: "main.ts", link: "/configuration/main-ts" },
          { text: "Ember Parameters", link: "/configuration/ember-parameters" },
          { text: "Migrating From @storybook/ember", link: "/configuration/migration" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/ember-integrations/ember-storybook" },
    ],

    editLink: {
      pattern: "https://github.com/ember-integrations/ember-storybook/edit/main/docs/:path",
      text: "Suggest changes to this page",
    },

    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2025-present Thomas Gossmann and contributors",
    },
  },
});
