/** @type {Partial<import("typedoc").TypeDocOptions>} */
export default {
  entryPoints: ['app/**/*'],
  outputs: [
    {
      name: 'json',
      path: './docs.json'
    }
  ],
  plugin: ['typedoc-plugin-ember']
};
