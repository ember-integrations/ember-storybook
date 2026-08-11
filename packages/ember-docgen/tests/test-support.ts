import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function tempFixture(files: Record<string, string>) {
  const base = mkdtempSync(path.join(tmpdir(), 'ember-storybook-test-'));

  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(base, rel);

    mkdirSync(path.join(abs, '..'), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  }

  return {
    base,
    [Symbol.dispose](): void {
      rmSync(base, { recursive: true, force: true });
    }
  };
}
