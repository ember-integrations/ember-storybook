import path from 'node:path';

import type { StoryFilePath } from './types';

const COMPONENT_RE = /\.g[tj]s$/;
const PROJECT_ROOT = process.cwd();

export const Default = '__DEFAULT__';

export type ExportedName = string;

export function normalizeFilePath(absPath: string): string {
  const relative = path.relative(PROJECT_ROOT, absPath);

  return './' + relative.replaceAll('\\', '/');
}

const storyFiles = new Set<string>();

const listeners = new Set<(filePath: string) => void>();

export function addStoryFileListener(listener: (filePath: string) => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function registerStoryFile(filePath: string) {
  storyFiles.add(filePath);

  for (const listener of listeners) {
    listener(filePath);
  }
}

export function getStoryFiles(): StoryFilePath[] {
  return [...storyFiles];
}

export function isStoryFile(filePath: string): boolean {
  return storyFiles.has(filePath);
}

export function isComponentFile(filePath: string): boolean {
  return COMPONENT_RE.test(filePath) && !isStoryFile(filePath);
}
