import { getService } from 'storybook/preview-api';
import emberData from 'virtual:ember-storybook';

import { parseEmberSignatures } from './docgen-payload';

import type { ComponentFile, EmberMeta } from '../../node/types';
import type { DocgenPayload } from 'storybook/internal/types';

const data = emberData as EmberMeta;

/** Whether Storybook's docgen server (opt-in) provides the signatures, rather than the bundle. */
export function docgenServerEnabled(): boolean {
  const features = (globalThis as { FEATURES?: Record<string, unknown> }).FEATURES;

  return features?.docgenServer === true || features?.experimentalDocgenServer === true;
}

const loads = new Map<string, Promise<void>>();

async function addSignatures(componentId: string): Promise<void> {
  const docgen = getService('core/docgen', { internal: true }) as {
    queries: { docgen: { loaded(input: { id: string }): Promise<DocgenPayload | undefined> } };
  };
  const payload = await docgen.queries.docgen.loaded({ id: componentId });

  for (const [file, fileSignatures] of Object.entries(parseEmberSignatures(payload))) {
    const entry = data[file] as ComponentFile | undefined;

    data[file] = {
      meta: entry?.meta ?? {},
      signatures: { ...entry?.signatures, ...fileSignatures }
    };
  }
}

async function fetchSignatures(componentId: string): Promise<void> {
  try {
    await addSignatures(componentId);
  } catch (error) {
    console.warn(`[ember-storybook] No signatures for ${componentId}:`, error);
  }
}

/**
 * With the docgen server, the bundle has no signatures: this fetches a
 * component's from its payload, once, and adds them to the data the docs page,
 * "Show code" and the args read. Without the server it does nothing.
 */
export function loadSignatures(componentId: string): Promise<void> {
  if (!docgenServerEnabled()) return Promise.resolve();

  let load = loads.get(componentId);

  if (!load) {
    load = fetchSignatures(componentId);
    loads.set(componentId, load);
  }

  return load;
}
