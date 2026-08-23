import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { tempFixture } from './test-support';

import { analyzeDeclarations, parseDeclarations } from '../src';

import type { HashBlockParam } from '../src';

const BUTTON_BUNDLE_DTS = `
import type { TOC } from '@ember/component/template-only';
import { type ButtonBlocks, type PushArgs, type PressedButtonArgs } from './-button';
type Simplify<T> = {
    [K in keyof T]: T[K];
};
type ToggleFn = (value: boolean) => void;
export interface ButtonSignature {
    /**
     * The element
     */
    Element: HTMLButtonElement | HTMLAnchorElement | HTMLSpanElement;
    Args: Simplify<Omit<PushArgs, 'push'> & Omit<PressedButtonArgs, 'push'> & {
        /** Invoked on push */
        push?: ToggleFn;
    }>;
    Blocks: ButtonBlocks;
}
export declare const Button: TOC<ButtonSignature>;
`;

const DEPS_BUNDLE_DTS = `
export interface ButtonBlocks {
    /** The label for the button */
    default: [];
    /** A slot in front of the label */
    before: [];
}
export interface PushArgs {
    push?: () => void;
    href?: string;
}
export interface PressedButtonArgs {
    /** Whether the button is pressed */
    pressed?: boolean;
}
`;

describe('analyzeDeclarations', () => {
  const bundles = {
    'app/button.gts': BUTTON_BUNDLE_DTS,
    'app/-button.gts': DEPS_BUNDLE_DTS,
    'app/toc.ts': ''
  };

  test('flattens composed signatures by resolving the emitted bundle', () => {
    const result = analyzeDeclarations(bundles);
    const sig = result['app/button.gts'].Button;

    expect(Object.keys(sig.args).sort()).toEqual(['href', 'pressed', 'push']);

    // Resolved through Simplify<Omit<PushArgs, 'push'> & …>
    expect(sig.args.href).toMatchObject({
      required: false,
      type: { category: 'string', raw: 'string' }
    });
    expect(sig.args.pressed).toMatchObject({
      required: false,
      description: 'Whether the button is pressed'
    });
    expect(sig.args.push).toMatchObject({
      required: false,
      description: 'Invoked on push',
      type: { category: 'function' }
    });

    expect(Object.keys(sig.blocks).sort()).toEqual(['before', 'default']);
    expect(sig.blocks.default.description).toBe('The label for the button');
    expect(sig.blocks.before.description).toBe('A slot in front of the label');
    expect(sig.element).toBe('HTMLButtonElement | HTMLAnchorElement | HTMLSpanElement');
  });

  test('supports inline TOC<{ ... }> signatures and @defaultValue', () => {
    const result = analyzeDeclarations({
      'app/section.gts': `
import type { TOC } from '@ember/component/template-only';

export declare const Section: TOC<{
    Element: HTMLElement;
    Args: {
        title?: string;
        /**
         * The level of the component
         *
         * @defaultValue 2
         */
        level?: string;
    };
    Blocks: {
        default: [];
    };
}>;
`
    });

    const sig = result['app/section.gts'].Section;

    expect(Object.keys(sig.args).sort()).toEqual(['level', 'title']);
    expect(sig.args.level.defaultValue).toBe('2');
    expect(sig.args.level.description).toBe('The level of the component');
    expect(Object.keys(sig.blocks)).toEqual(['default']);
    expect(sig.element).toBe('HTMLElement');
  });

  test('resolves block param componentRefs with WithBoundArgs modifiers', () => {
    const result = analyzeDeclarations({
      'app/list.gts': `
import type { TOC } from '@ember/component/template-only';
import type { WithBoundArgs } from '@glint/template';
import type { Option } from './option';
interface ListSignature {
    Blocks: {
        default: [
            {
                /** An option row */
                Option: WithBoundArgs<typeof Option, 'isSelected' | 'registerItem'>;
            }
        ];
    };
}
export declare const List: TOC<ListSignature>;
`,
      'app/option.gts': `
export declare const Option: TOC<{
    Element: HTMLOptionElement;
    Args: { value: string };
}>;
`
    });

    const list = result['app/list.gts'].List;
    const param = (list.blocks.default!.params[0] as HashBlockParam).Option;

    expect(param?.description).toBe('An option row');
    expect(param?.componentRef).toMatchObject({
      filePath: 'app/option.gts',
      exportName: 'Option'
    });
    expect(param?.componentRef?.modifiers).toEqual([
      { name: 'WithBoundArgs', typeArgs: ['isSelected', 'registerItem'] }
    ]);
  });
});

describe('analyzeDeclarations — origin checks', () => {
    test('rejects a local TOC without matching import origin', () => {
    const result = analyzeDeclarations({
      'app/local.gts': `
export interface LocalSignature {
    Element: HTMLElement;
    Args: { label: string };
}
// Local shim — NOT imported from '@ember/component/template-only'
type TOC<T> = { [K in keyof T]: T[K] };
export declare const Local: TOC<LocalSignature>;
`
    });

    expect(result).toEqual({});
  });

  test('accepts renamed imports of the canonical wrapper', () => {
    const result = analyzeDeclarations({
      'app/renamed.gts': `
import type { TOC as TemplateOnlyComponent } from '@ember/component/template-only';
export interface RenamedSignature {
    Element: HTMLElement;
    Args: { label: string };
}
export declare const Renamed: TemplateOnlyComponent<RenamedSignature>;
`
    });

    const sig = result['app/renamed.gts'].Renamed;

    expect(sig.args.label).toMatchObject({ required: true });
    expect(sig.element).toBe('HTMLElement');
  });

  test('rejects TOC imported from an invalid location', () => {
    const result = analyzeDeclarations({
      // Resolvable, export-compatible — but the WRONG origin
      'app/lookalike.gts': `
export type TOC<T> = { [K in keyof T]: T[K] };
`,
      'app/consumer.gts': `
import type { TOC } from './lookalike';
export interface ConsumerSignature {
    Element: HTMLElement;
    Args: { label: string };
}
export declare const Consumer: TOC<ConsumerSignature>;
`
    });

    expect(result['app/consumer.gts']).toBeUndefined();
  });

  test('rejects non-wrapper exports from the canonical module', () => {
    const result = analyzeDeclarations({
      'app/misuse.gts': `
import type { EmptyObject } from '@ember/component/template-only';
export declare const Misuse: EmptyObject;
`
    });

    expect(result).toEqual({});
  });
});

describe('parseDeclarations + analyzeDeclarations', () => {
  test('emits declarations for .gts sources and extracts signatures', async () => {
    using fix = tempFixture({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          strict: true,
          target: 'esnext',
          module: 'esnext',
          moduleResolution: 'bundler',
          skipLibCheck: true,
          lib: ['esnext', 'dom']
        },
        include: ['app/**/*']
      }),
      'app/button.gts': `
import type { TOC } from '@ember/component/template-only';

interface ButtonBlocks {
  /** The label for the button */
  default: [];
}

type ToggleFn = (value: boolean) => void;

export interface ButtonSignature {
  Element: HTMLButtonElement | HTMLAnchorElement;
  Args: { label: string; push?: ToggleFn };
  Blocks: ButtonBlocks;
}

export const Button = {} as unknown as TOC<ButtonSignature>;
`.trim(),
      'app/toc.ts': `
export type TOC<T> = { [K in keyof T]: T[K]; } & ((args: T extends { Args: infer A } ? A : never) => unknown);
`.trim()
    });

    const file = path.join(fix.base, 'app/button.gts');
    const bundles = await parseDeclarations([file], {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });
    const sigs = analyzeDeclarations(bundles);

    const sig = sigs['app/button.gts'].Button;

    expect(sig.args.label).toMatchObject({ required: true, type: { category: 'string' } });
    expect(sig.args.push).toMatchObject({ required: false, type: { category: 'function' } });
    expect(sig.blocks.default!.description).toBe('The label for the button');
    expect(sig.element).toBe('HTMLButtonElement | HTMLAnchorElement');
  });

  test('returns no declarations when no tsconfig is found', async () => {
    using fix = tempFixture({ 'app/a.ts': 'export const a = 1;' });

    const bundles = await parseDeclarations([path.join(fix.base, 'app/a.ts')]);

    expect(bundles).toEqual({});
  });
});
