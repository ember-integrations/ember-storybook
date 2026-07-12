import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { readAllMetaCaches, writeMetaCache } from './cache';

function tempDir() {
  const base = mkdtempSync(path.join(tmpdir(), 'ember-storybook-cache-'));

  return {
    base,
    [Symbol.dispose](): void {
      rmSync(base, { recursive: true, force: true });
    }
  };
}

describe('writeMetaCache', () => {
  test('writes a JSON file at the expected path', async () => {
    using dir = tempDir();

    const meta = { 'story--one': { componentName: 'Greeting', inlineTemplate: '<Hi />' } };
    const fileName = 'test.stories.gjs';
    const hash = createHash('md5').update(fileName).digest('hex');

    await writeMetaCache(dir.base, fileName, meta);

    const cached = JSON.parse(
      await readFile(
        path.join(dir.base, 'node_modules', '.cache', 'ember-storybook', `${hash}.json`),
        'utf8'
      )
    ) as Record<string, unknown>;

    expect(cached).toEqual(meta);
  });

  test('overwrites an existing cache file for the same source', async () => {
    using dir = tempDir();

    const fileName = 'overwrite.stories.gjs';

    await writeMetaCache(dir.base, fileName, { s1: { componentName: 'A' } });
    await writeMetaCache(dir.base, fileName, { s2: { componentName: 'B' } });

    const merged = readAllMetaCaches(dir.base);

    expect(merged).toEqual({ s2: { componentName: 'B' } });
  });
});

describe('readAllMetaCaches', () => {
  test('returns an empty object when no cache directory exists', () => {
    const result = readAllMetaCaches('/tmp/nonexistent-opencode-test-dir-12345');

    expect(result).toEqual({});
  });

  test('reads and merges multiple cache files', async () => {
    using dir = tempDir();
    await writeMetaCache(dir.base, 'a.stories.gjs', {
      'story--a': { componentName: 'A' }
    });
    await writeMetaCache(dir.base, 'b.stories.gjs', {
      'story--b': { componentName: 'B', inlineTemplate: '<B />' }
    });

    const merged = readAllMetaCaches(dir.base);

    expect(merged).toEqual({
      'story--a': { componentName: 'A' },
      'story--b': { componentName: 'B', inlineTemplate: '<B />' }
    });
  });

  test('skips corrupted JSON files silently', async () => {
    using dir = tempDir();
    // Write a valid cache
    await writeMetaCache(dir.base, 'good.stories.gjs', {
      good: { componentName: 'Good' }
    });

    // Write a corrupted file alongside it
    const cacheDir = path.join(dir.base, 'node_modules', '.cache', 'ember-storybook');
    const hash = createHash('md5').update('bad.stories.gjs').digest('hex');

    await writeFile(path.join(cacheDir, `${hash}.json`), '{broken json', 'utf8');

    const merged = readAllMetaCaches(dir.base);

    expect(merged).toEqual({ good: { componentName: 'Good' } });
  });
});
