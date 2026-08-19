import { describe, expect, test, vi } from 'vitest';

import {
  type ApplicationInstanceClass,
  createAppResolver,
  type EmberStoryResult,
  isEmberStoryResult,
  normalizeStoryResult
} from './story-result';

function makeAppInstance(options: Record<string, unknown>): { buildInstance: () => object } {
  return { buildInstance: () => ({ from: 'create', ...options }) };
}

class EmberApp {
  static create = vi.fn(makeAppInstance);

  dev = false;
}

class FakeApp extends EmberApp {}

class FakeInstance {
  marker = 1;
}

const component = (): number => 1;
const templateComponent = (): number => 1;

const resolver = createAppResolver({
  application: EmberApp,
  applicationInstance: FakeInstance
}) as (appOption: unknown, opts: { rootElement: HTMLElement }) => ApplicationInstanceClass;

const opts = { rootElement: {} as HTMLElement };

describe('isEmberStoryResult', () => {
  test('detects the framework render result', () => {
    expect(isEmberStoryResult({ component: { tag: 'comp' }, args: {} })).toBe(true);
  });

  test('rejects bare components and templates', () => {
    expect(isEmberStoryResult(component)).toBe(false);
    expect(isEmberStoryResult(templateComponent)).toBe(false);
    // eslint-disable-next-line unicorn/no-null
    expect(isEmberStoryResult(null)).toBe(false);
    expect(isEmberStoryResult('x')).toBe(false);
    expect(isEmberStoryResult({ args: {} })).toBe(false);
    expect(isEmberStoryResult({ component: {} })).toBe(false);
  });
});

describe('normalizeStoryResult', () => {
  test('uses the args reported by the framework render (decorated args)', () => {
    const result: EmberStoryResult = { component: { tag: 'comp' }, args: { name: 'decorated' } };

    expect(normalizeStoryResult(result, { name: 'raw' })).toEqual(result);
  });

  test('uses the fallback args for components/templates returned by a custom render', () => {
    expect(normalizeStoryResult(component, { name: 'fallback' })).toEqual({
      component,
      args: { name: 'fallback' }
    });
  });
});

describe('createAppResolver', () => {
  test('returns an ApplicationInstance unchanged', () => {
    const instance = new FakeInstance();

    expect(resolver(instance, opts)).toBe(instance);
  });

  test('builds an instance from an Application class with autoboot disabled', () => {
    const instance = resolver(FakeApp, opts);

    expect(instance).toEqual(expect.objectContaining({ from: 'create' }));
    expect(EmberApp.create).toHaveBeenCalledWith(
      expect.objectContaining({ autoboot: false, rootElement: opts.rootElement })
    );
  });

  test('resolves a factory that returns an ApplicationInstance', () => {
    const instance = resolver(() => new FakeInstance(), opts);

    expect(instance).toBeInstanceOf(FakeInstance);
  });

  test('passes the rootOptions to the factory', () => {
    const factory = (options?: Record<string, unknown>) => {
      expect(options).toEqual(
        expect.objectContaining({ autoboot: false, rootElement: opts.rootElement })
      );

      return new FakeInstance();
    };

    expect(resolver(factory, opts)).toBeInstanceOf(FakeInstance);
  });
});
