import path from 'node:path';

import { afterAll, describe, expect, test, vi } from 'vitest';

import { tempFixture } from './test-support';

import { registerStoryFile } from './shared';
import { emberStorybookPlugin } from './vite-plugin';

import type { Plugin } from 'vite';

const STORY = `
import { Greeting } from './greeting.gts';
export default { component: Greeting, title: 'Race/Greeting' } satisfies Meta;
export const Hello: StoryObj = {
  render: (args) => <template><Greeting @name={{args.name}} /></template>
};
`.trim();

type Hook = Plugin['buildStart'] | Plugin['configResolved'] | Plugin['load'];

function call(hook: Hook, ...args: unknown[]): unknown {
  const handler = typeof hook === 'function' ? hook : hook?.handler;

  return (handler as ((...a: unknown[]) => unknown) | undefined)?.call({}, ...args);
}

function plugin(plugins: Plugin[], name: string): Plugin {
  const found = plugins.find((p) => p.name === name);

  if (!found) throw new Error(`no ${name} plugin`);

  return found;
}

async function virtualModule(plugins: Plugin[]): Promise<string> {
  const loaded = (await call(
    plugin(plugins, 'ember-storybook').load,
    '\0virtual:ember-storybook'
  )) as { code: string };

  return loaded.code;
}

describe('emberStorybookPlugin', () => {
  // Story files stay registered for the whole process, so the fixture has to
  // outlive every test here.
  const fix = tempFixture({ 'race.stories.gts': STORY });
  const storyPath = path.join(fix.base, 'race.stories.gts');

  afterAll(() => fix[Symbol.dispose]());

  test('in a build, contributors wait for the story index before reading story files', async () => {
    // `storybook build` indexes the stories while Vite builds: the story file
    // is only registered once the index is ready.
    const plugins = emberStorybookPlugin({
      waitForStoryIndex: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        registerStoryFile(storyPath);
      }
    });

    call(plugin(plugins, 'ember-storybook:build-mode').configResolved, { command: 'build' });
    await call(plugin(plugins, 'ember-storybook:source').buildStart);

    expect(await virtualModule(plugins)).toContain('race-greeting--hello');
  });

  test("in dev, contributors don't wait for the story index", async () => {
    const waitForStoryIndex = vi.fn(() => Promise.resolve());
    const plugins = emberStorybookPlugin({ waitForStoryIndex });

    call(plugin(plugins, 'ember-storybook:build-mode').configResolved, { command: 'serve' });
    await call(plugin(plugins, 'ember-storybook:source').buildStart);
    await call(plugin(plugins, 'ember-storybook:meta').buildStart);

    expect(waitForStoryIndex).not.toHaveBeenCalled();
  });
});
