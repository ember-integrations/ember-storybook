import { getService } from 'storybook/preview-api';
import emberData, { docgenServer } from 'virtual:ember-storybook';

import { parseEmberSignatures } from './docgen-payload';

import type { ComponentFile, EmberMeta } from '../../node/types';
import type { DocgenPayload } from 'storybook/internal/types';

const data = emberData as EmberMeta;
const loads = new Map<string, Promise<void>>();
const loaded = new Set<string>();

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

  loaded.add(componentId);
}

async function fetchSignatures(componentId: string): Promise<void> {
  try {
    await addSignatures(componentId);
  } catch (error) {
    // The next render asks again.
    loads.delete(componentId);
    console.warn(`[ember-storybook] No signatures for ${componentId}:`, error);
  }
}

/** Whether the signatures come from Storybook's docgen server, as the Vite plugin decided. */
export function usesDocgenServer(): boolean {
  return docgenServer;
}

/** Whether a component's signatures are still to come from the docgen server. */
export function signaturesPending(componentId: string): boolean {
  return docgenServer && !loaded.has(componentId);
}

/**
 * Resolves once Storybook has a component's story docs, which it shows as a
 * story's code when they arrive.
 */
export async function storyDocsLoaded(componentId: string): Promise<void> {
  try {
    const storyDocs = getService('core/story-docs', { internal: true }) as {
      queries: { storyDocs: { loaded(input: { id: string }): Promise<unknown> } };
    };

    await storyDocs.queries.storyDocs.loaded({ id: componentId });
  } catch {
    // Nothing of Storybook's to wait for.
  }
}

/**
 * With the docgen server, the bundle has no signatures: this fetches a
 * component's from its payload, once, and adds them to the data the docs page
 * and "Show code" read. Without the server it does nothing.
 */
export function loadSignatures(componentId: string): Promise<void> {
  if (!signaturesPending(componentId)) return Promise.resolve();

  let load = loads.get(componentId);

  if (!load) {
    load = fetchSignatures(componentId);
    loads.set(componentId, load);
  }

  return load;
}
