import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { StoryMeta } from './types';

// ── Cache file I/O ────────────────────────────────────────────────

const CACHE_DIR = ['node_modules', '.cache', 'ember-storybook'];

function cacheDir(root: string): string {
  return path.join(root, ...CACHE_DIR);
}

function cacheFilePath(root: string, fileName: string): string {
  const hash = createHash('md5').update(fileName).digest('hex');

  return path.join(cacheDir(root), `${hash}.json`);
}

export async function writeMetaCache(
  root: string,
  fileName: string,
  meta: Record<string, StoryMeta>
): Promise<void> {
  const dir = cacheDir(root);
  const file = cacheFilePath(root, fileName);

  await mkdir(dir, { recursive: true });

  const tmp = file + '.tmp';

  await writeFile(tmp, JSON.stringify(meta));
  await rename(tmp, file);
}

export function readAllMetaCaches(projectRoot: string): Record<string, StoryMeta> {
  const dir = path.join(projectRoot, ...CACHE_DIR);
  const meta: Record<string, StoryMeta> = {};

  if (!existsSync(dir)) return meta;

  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Record<
        string,
        StoryMeta
      >;

      Object.assign(meta, data);
    } catch {
      // skip corrupt files
    }
  }

  return meta;
}
