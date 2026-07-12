declare module 'virtual:ember-storybook-meta' {
  const meta: Record<
    string,
    { componentName: string; inlineTemplate?: string; storyFilePath: string }
  >;

  export default meta;
}

declare let STORYBOOK_ENV: 'ember';
