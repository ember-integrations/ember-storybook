import type { ComponentSignature } from 'ember-docgen';
import type { DocgenPayload } from 'storybook/internal/types';

/** The signatures an Ember docgen payload carries, by project-relative file. */
export function parseEmberSignatures(
  payload: DocgenPayload | undefined
): Record<string, Record<string, ComponentSignature>> {
  const signatures = payload?.emberSignatures;

  return typeof signatures === 'string'
    ? (JSON.parse(signatures) as Record<string, Record<string, ComponentSignature>>)
    : {};
}
