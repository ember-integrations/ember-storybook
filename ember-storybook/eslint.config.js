import ember from '@gossi/config-eslint/ember';

export default [
  ...ember(import.meta.dirname),
  {
    files: ['eslint.config.js', 'prettier.config.js', 'tsdown.config.js'],
    rules: {
      'n/no-unpublished-import': 'off'
    }
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off'
    }
  }
];
