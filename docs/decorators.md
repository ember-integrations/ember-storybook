# Decorators

[Decorators](https://storybook.js.org/docs/writing-stories/decorators) allow you to wrap a story with extra functionality — adding
layout, injecting context data, conditionally rendering, or observing
rendering behavior.

`ember-storybook` provides two ways of writing decorators:

1. Pass-Through with Higher Order Function
2. Visually with Template

## 1. Pass-Through with Higher Order Function

The simplest pattern. The decorator receives the story and returns it
unchanged (or with modified args).

```glimmer-ts
decorators: [
  (Story, context) => {
    // Modify args before the story renders
    context.args.user = currentUser;
    context.args.theme = 'dark';

    // Return the original story — args flow automatically
    return Story();
  }
]
```

**Use this when**

- Adding data (user, session, feature flags) to the render context
- Logging or telemetry
- Conditionally replacing the component while keeping args intact

## 2. Visually with Template

To visually wrap any story without, use the `<RenderStory>` component
provided by `ember-storybook`.

```glimmer-ts
import { RenderStory } from 'ember-storybook';

decorators: [
  (Story, context) => <template>
    <div class="border rounded p-4">
      <p class="text-sm text-gray-500 mb-2">Wrapped story</p>
      <RenderStory @story={{Story}} @args={{context.args}} />
    </div>
  </template>
]
```

You can modify args and still use the visual wrapper:

```glimmer-ts
decorators: [
  (Story, context) => {
    context.args.theme = 'compact';
    return <template>
      <div class="compact-layout">
        <RenderStory @story={{Story}} @args={{context.args}} />
      </div>
    </template>;
  }
]
```

Multiple wrappers compose naturally:

```glimmer-ts
decorators: [
  (Story, context) => <template>
    <div class="card"><RenderStory @story={{Story}} @args={{context.args}} /></div>
  </template>,

  (Story, context) => <template>
    <div class="theme-dark"><RenderStory @story={{Story}} @args={{context.args}} /></div>
  </template>,
]
```

**Use this when**

- You need to add visual wrapping (layout, borders, toolbars)
- The story's arg keys are not known in advance
- You want a generic, reusable decorator

## Appendix

The `Decorator` type is available as an import for type safety:

```typescript
import type { Decorator } from 'ember-storybook';
```

> [!NOTE] Execution Context
>
> Decorators run in a node process through storybook. They don't know the
> context they are executed in, as they would in an ember app.
