import type { ComponentMap } from './parser';
import type { ComponentSignature } from 'ember-docgen';
import type { StaticMeta } from 'storybook/internal/csf-tools';

export type StoryFile = {
  meta: StaticMeta;
  component: {
    file?: string;
    signatureName?: string;
  };
  source?: Record<string, string | undefined>;
};

export type ComponentFile = {
  meta: ComponentMap;
  signatures: Record<string, ComponentSignature>;
};

/** The path to a story file, relative to the root of the project */
export type StoryFilePath = string;
/** The path to a component file, relative to the root of the project */
export type ComponentFilePath = string;

/**
 * Represents the format for Ember Meta
 *
 * - key: filePath relative to project root
 * - value: Metadata for that file
 */
// eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
export type EmberMeta = Record<StoryFilePath | ComponentFilePath, StoryFile | ComponentFile>;
