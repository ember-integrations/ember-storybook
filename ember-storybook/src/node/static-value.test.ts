import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { tempFixture } from './test-support';

import { parseStoryFile, type StoryFile } from './parser';

describe('parseStoryFile docs', () => {
  test('reads static args and docs descriptions from the meta and stories', () => {
    using fix = tempFixture({
      'test.stories.gts': `
import { fn } from 'storybook/test';
import { Greeting } from './greeting.gts';

export default {
  title: 'Greeting',
  component: Greeting,
  args: { name: 'Ada', count: 2, onGreet: fn() },
  parameters: { docs: { description: { component: 'Says hello.' } } }
} satisfies Meta;

export const Loud: StoryObj = {
  args: { loud: true, tags: ['a', \`b\`], size: -1, extra: null },
  parameters: { docs: { description: { story: 'Shouts.' } } }
};

export const Plain: StoryObj = {};
`.trim()
    });

    const result = parseStoryFile(path.join(fix.base, 'test.stories.gts')) as StoryFile;

    expect(result.docs.args).toEqual({ name: 'Ada', count: 2 });
    expect(result.docs.description).toBe('Says hello.');

    const idOf = (name: string) => result.stories.find((story) => story.name === name)?.id ?? '';

    expect(result.docs.stories[idOf('Loud')]).toEqual({
      args: { loud: true, tags: ['a', 'b'], size: -1, extra: undefined },
      description: 'Shouts.'
    });
    expect(result.docs.stories[idOf('Plain')]).toEqual({ args: {}, description: undefined });
  });
});
