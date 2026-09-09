import { describe, expect, test, vi } from 'vitest';

// The real modules drag in the Ember render layer (`./config` → `./render` →
// `@ember/*`) and the `virtual:ember-storybook` module — neither exists in the
// node test environment, so both annotation tiers are stubbed. The point of
// these tests is *composition*, not the annotation values.
//
// `definePreview` computes `preview.composed` eagerly, which runs core's
// `composeConfigs` over every module — and it reads *every* known annotation
// key off each one (vitest throws `MissingExport` for keys a mock does not
// declare), so the stubs enumerate the full key list, `default` included.
// Everything the mock factories touch must live inside `vi.hoisted`.
const { mocks, shim } = vi.hoisted(() => {
  const keys = [
    'afterEach',
    'applyDecorators',
    'argTypes',
    'argTypesEnhancers',
    'args',
    'argsEnhancers',
    'beforeAll',
    'beforeEach',
    'decorators',
    'globalTypes',
    'initialGlobals',
    'loaders',
    'mount',
    'parameters',
    'render',
    'renderToCanvas',
    'runStep',
    'tags',
    'testingLibraryRender'
  ];

  const annotationShim = (values: Record<string, unknown>) => ({
    default: {},
    ...Object.fromEntries(keys.map((key) => [key, values[key]]))
  });

  const framework = {
    render: vi.fn(),
    renderToCanvas: vi.fn(),
    parameters: { renderer: 'ember' },
    globalTypes: { outlet: { defaultValue: 'hole' } },
    argTypesEnhancers: [vi.fn()]
  };

  const docs = {
    parameters: { docs: { source: { type: 'dynamic' } } },
    decorators: [vi.fn()],
    argTypesEnhancers: [vi.fn()]
  };

  return { mocks: { framework, docs }, shim: annotationShim };
});

vi.mock('./config', () => shim(mocks.framework));

vi.mock('./docs/annotations', () => shim(mocks.docs));

import { definePreview } from './define-preview';

const userRenderToCanvas = vi.fn();

describe('definePreview', () => {
  test('returns a tagged Preview whose composed annotations include the framework tier', () => {
    const preview = definePreview({});

    expect(preview._tag).toBe('Preview');

    const composed = preview.composed;

    expect(composed.render).toBe(mocks.framework.render);
    expect(composed.renderToCanvas).toBe(mocks.framework.renderToCanvas);
    expect(composed.parameters).toMatchObject({ renderer: 'ember' });
    expect(composed.globalTypes).toHaveProperty('outlet');
    expect(composed.argTypesEnhancers).toContain(mocks.docs.argTypesEnhancers[0]);
    expect(composed.argTypesEnhancers).toContain(mocks.framework.argTypesEnhancers[0]);
    expect(composed.decorators).toContain(mocks.docs.decorators[0]);
  });

  test('merges the user preview configuration into composed', () => {
    const preview = definePreview({
      parameters: {
        ember: {},
        layout: 'centered'
      },
      globalTypes: { locale: { defaultValue: 'en' } },
      initialGlobals: { locale: 'en' },
      tags: ['autodocs'],
      renderToCanvas: userRenderToCanvas
    });

    const composed = preview.composed;

    expect(composed.parameters).toMatchObject({
      ember: {},
      layout: 'centered'
    });
    expect(composed.globalTypes).toHaveProperty('locale');
    expect(composed.initialGlobals).toMatchObject({ locale: 'en' });
    expect(composed.tags).toContain('autodocs');
    // The framework injects its annotations after the user's addons, but the
    // user's own top-level keys are merged last and win.
    expect(composed.renderToCanvas).toBe(userRenderToCanvas);
  });

  test('keeps user-registered addon annotations in the composition', () => {
    const addon = { parameters: { a11y: { manual: true } } };
    const preview = definePreview({ addons: [addon] as never });

    expect(preview.composed.parameters).toMatchObject({ a11y: { manual: true } });
  });

  test('registers the composed annotations globally (setProjectAnnotations replacement)', () => {
    const preview = definePreview({});

    expect(globalThis.globalProjectAnnotations).toBe(preview.composed);

    delete (globalThis as { globalProjectAnnotations?: unknown }).globalProjectAnnotations;
  });

  test('preview.meta() creates a factory Meta carrying the composed preview', () => {
    const preview = definePreview({});
    const component = { isEmberComponentLike: true };

    const meta = preview.meta({ component, title: 'X' });

    expect(meta._tag).toBe('Meta');
    expect(meta.preview).toBe(preview);
    expect(meta.input.component).toBe(component);
    // Core marks factory metas so the docs/source machinery can detect them.
    expect((meta.input as { parameters?: unknown }).parameters).toMatchObject({
      csfFactory: true
    });

    const story = meta.story({ args: {} });

    expect(story._tag).toBe('Story');
    expect(story.meta).toBe(meta);
  });
});
