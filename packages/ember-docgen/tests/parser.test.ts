import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { tempFixture } from './test-support';

import { extractBlockParamModifiers } from '../src/parser';

describe('extractBlockParamModifiers', () => {
  test('extracts WithBoundArgs from block param type', () => {
    using fix = tempFixture({
      'list.gts': `
import Component from '@glimmer/component';
import type { WithBoundArgs } from '@glint/template';

interface ListSignature {
  Blocks: {
    default: [
      {
        Option: WithBoundArgs<typeof Option, 'isSelected' | 'registerItem'>;
      }
    ];
  };
}

export class List extends Component<ListSignature> {
  <template>{{yield (hash Option=(component this.Option isSelected=this.isSelected))}}</template>
}
`.trim()
    });

    const result = extractBlockParamModifiers(path.join(fix.base, 'list.gts'));

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      paramName: 'Option',
      wrapperName: 'WithBoundArgs',
      boundKeys: ['isSelected', 'registerItem']
    });
  });

  test('returns empty for interface without Blocks', () => {
    using fix = tempFixture({
      'component.gts': `
interface SimpleSignature {
  Args: {
    name: string;
  };
}
`.trim()
    });

    const result = extractBlockParamModifiers(path.join(fix.base, 'component.gts'));

    expect(result).toEqual([]);
  });

  test('returns empty for block param without typeof query', () => {
    using fix = tempFixture({
      'component.gts': `
import Component from '@glimmer/component';

interface CompSignature {
  Blocks: {
    default: [
      {
        name: string;
      }
    ];
  };
}

class Comp extends Component<CompSignature> {}
`.trim()
    });

    const result = extractBlockParamModifiers(path.join(fix.base, 'component.gts'));

    expect(result).toEqual([]);
  });

  test('handles generic component in typeof', () => {
    using fix = tempFixture({
      'list.gts': `
import Component from '@glimmer/component';
import type { WithBoundArgs } from '@glint/template';

interface ListSignature<V> {
  Blocks: {
    default: [
      {
        Option: WithBoundArgs<typeof Option<V>, 'isSelected' | 'registerItem' | 'unregisterItem'>;
      }
    ];
  };
}

export class List<V> extends Component<ListSignature<V>> {
  <template>{{yield (hash Option=(component this.Option isSelected=this.isSelected))}}</template>
}
`.trim()
    });

    const result = extractBlockParamModifiers(path.join(fix.base, 'list.gts'));

    expect(result).toHaveLength(1);
    expect(result[0].wrapperName).toBe('WithBoundArgs');
    expect(result[0].boundKeys).toEqual(['isSelected', 'registerItem', 'unregisterItem']);
  });

  test('handles multiple block params in same block', () => {
    using fix = tempFixture({
      'component.gts': `
import Component from '@glimmer/component';

interface CompSignature {
  Blocks: {
    default: [
      {
        Item: WithBoundArgs<typeof A, 'x'>;
        Row: WithBoundArgs<typeof B, 'y' | 'z'>;
      }
    ];
  };
}

class Comp extends Component<CompSignature> {}
`.trim()
    });

    const result = extractBlockParamModifiers(path.join(fix.base, 'component.gts'));

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      paramName: 'Item',
      wrapperName: 'WithBoundArgs',
      boundKeys: ['x']
    });
    expect(result[1]).toEqual({
      paramName: 'Row',
      wrapperName: 'WithBoundArgs',
      boundKeys: ['y', 'z']
    });
  });

  test('handles multiple named blocks', () => {
    using fix = tempFixture({
      'component.gts': `
import Component from '@glimmer/component';

interface CompSignature {
  Blocks: {
    default: [{ Content: Omit<typeof X, 'a'> }];
    header: [{ Title: Pick<typeof Y, 'b'> }];
    footer: [];
  };
}

class Comp extends Component<CompSignature> {}
`.trim()
    });

    const result = extractBlockParamModifiers(path.join(fix.base, 'component.gts'));

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ paramName: 'Content', wrapperName: 'Omit', boundKeys: ['a'] });
    expect(result[1]).toEqual({ paramName: 'Title', wrapperName: 'Pick', boundKeys: ['b'] });
  });

  test('returns empty for plain typeof X without wrapper', () => {
    using fix = tempFixture({
      'component.gts': `
import Component from '@glimmer/component';

interface CompSignature {
  Blocks: {
    default: [{ item: typeof SomeComponent }];
  };
}

class Comp extends Component<CompSignature> {}
`.trim()
    });

    const result = extractBlockParamModifiers(path.join(fix.base, 'component.gts'));

    // No TSTypeReference wrapper with typeArguments → no modifier
    expect(result).toEqual([]);
  });

  test('skips namedBlock params (non-tuple yield)', () => {
    using fix = tempFixture({
      'component.gts': `
import Component from '@glimmer/component';

interface CompSignature {
  Blocks: {
    content: { component: typeof X; visible: boolean };
  };
}

class Comp extends Component<CompSignature> {}
`.trim()
    });

    const result = extractBlockParamModifiers(path.join(fix.base, 'component.gts'));

    // Named params without wrapper should return empty
    expect(result).toEqual([]);
  });

  test('skip extracting modifier from namedBlock param with wrapper (non-tuple yield)', () => {
    using fix = tempFixture({
      'component.gts': `
import Component from '@glimmer/component';

interface CompSignature {
  Blocks: {
    content: { item: WithBoundArgs<typeof SomeComponent, 'label'> };
  };
}

class Comp extends Component<CompSignature> {}
`.trim()
    });

    const result = extractBlockParamModifiers(path.join(fix.base, 'component.gts'));

    expect(result).toHaveLength(0);
  });

  test('matches Glint docs example: Omit', () => {
    using fix = tempFixture({
      'my-component.gts': `
import { ComponentLike } from '@glint/template';
import { SomeBannerSignature } from './some-banner';

interface MyComponentSignature {
  Blocks: {
    default: [{
      banner: ComponentLike<{
        Element: SomeBannerSignature['Element'];
        Blocks: SomeBannerSignature['Blocks'];
        Args: 
          Omit<SomeBannerSignature['Args'], 'kind'> 
            & { kind?: SomeBannerSignature['Args']['kind'] };
      }>;
    }];
  };
}

class MyComponent extends Component<MyComponentSignature> {}
`.trim()
    });

    const result = extractBlockParamModifiers(path.join(fix.base, 'my-component.gts'));

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      paramName: 'banner',
      wrapperName: 'Omit',
      boundKeys: ['kind']
    });
  });
});
