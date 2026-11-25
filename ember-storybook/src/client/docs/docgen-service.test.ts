import { beforeEach, describe, expect, test, vi } from 'vitest';

const loaded = vi.fn();

vi.mock('storybook/preview-api', () => ({
  getService: () => ({ queries: { docgen: { loaded } } })
}));

vi.mock('virtual:ember-storybook', () => ({
  docgenServer: true,
  default: { './list.gts': { meta: { __DEFAULT__: 'List' }, signatures: {} } }
}));

const signature = {
  args: {},
  blocks: {},
  element: undefined,
  style: { customProperties: {}, parts: {} }
};

describe('loadSignatures', () => {
  beforeEach(() => {
    vi.resetModules();
    loaded.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(vi.fn());
  });

  test('adds a payload’s signatures to the docs data, once', async () => {
    loaded.mockResolvedValue({
      emberSignatures: JSON.stringify({
        './list.gts': { __DEFAULT__: signature },
        './item.gts': { Item: signature }
      })
    });

    const { loadSignatures, signaturesPending } = await import('./docgen-service');
    const { default: data } = (await import('virtual:ember-storybook')) as { default: unknown };

    expect(signaturesPending('list')).toBe(true);

    await loadSignatures('list');
    await loadSignatures('list');

    expect(loaded).toHaveBeenCalledTimes(1);
    expect(signaturesPending('list')).toBe(false);
    expect(data).toEqual({
      './list.gts': { meta: { __DEFAULT__: 'List' }, signatures: { __DEFAULT__: signature } },
      './item.gts': { meta: {}, signatures: { Item: signature } }
    });
  });

  test('asks again after a failed load', async () => {
    loaded.mockRejectedValueOnce(new Error('Timed out')).mockResolvedValue(undefined);

    const { loadSignatures, signaturesPending } = await import('./docgen-service');

    await loadSignatures('list');

    expect(signaturesPending('list')).toBe(true);

    await loadSignatures('list');

    expect(loaded).toHaveBeenCalledTimes(2);
    expect(signaturesPending('list')).toBe(false);
  });
});
