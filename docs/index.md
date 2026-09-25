---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "ember-storybook"
  text: "Storybook for Ember"
  tagline: Develop, document, and test your UI components in isolation. A workshop for your components.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: Writing Stories
      link: /guide/writing-stories
    - theme: alt
      text: GitHub
      link: https://github.com/ember-integrations/ember-storybook

features:
  - title: Built for modern Ember
    details: Ember 6.8+ with Vite and Storybook 10.
  - title: Controls from your signatures
    details: Auto generated Controls and Signature for your components.
  - title: Stories, tests, docs — one source
    details: The same story feeds the docs page, the interaction test (play function), and Vitest browser tests.
  - title: Route stories included
    details: Templates with {{outlet}} are a first-class story type, with a toolbar to render the outlet as a hole or a placeholder.
---
