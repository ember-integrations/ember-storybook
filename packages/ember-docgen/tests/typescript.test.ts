import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { tempFixture } from './test-support';

import { Default, parseSignatures } from '../src';

import type { HashBlockParam } from '../src';

const TSCONFIG = `
{
  "compilerOptions": {
    "strict": true,
    "target": "esnext",
    "module": "esnext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "lib": ["esnext", "dom"]
  },
  "include": ["app/**/*"]
}
`.trim();

function fixture(files: Record<string, string>) {
  return tempFixture({
    'tsconfig.json': TSCONFIG,
    ...Object.fromEntries(Object.entries(files).map(([file, content]) => [`app/${file}`, content]))
  });
}

describe('parseSignatures', () => {
  test('executes a composed signature (hokulea button shape)', async () => {
    using fix = fixture({
      '-button.ts': `
/** Args of pressed buttons */
export interface PressedButtonArgs {
  /** Whether the button is pressed */
  pressed?: boolean;
}

export interface ButtonArgs {
  intent?: string;
  importance?: 'normal' | 'supreme';
}

export interface ButtonBlocks {
  /** The label for the button */
  default: [];

  /** A slot in front of the label */
  before: [];
}
`.trim(),
      'button.gts': `
import type { TOC } from '@ember/component/template-only';
import { type ButtonArgs, type ButtonBlocks, type PressedButtonArgs } from './-button';

type Simplify<T> = { [K in keyof T]: T[K] };

export interface PushArgs {
  push?: () => void;
  href?: string;
}

type ToggleFn = (value: boolean) => void;

export interface ButtonSignature {
  Element: HTMLButtonElement | HTMLAnchorElement | HTMLSpanElement;
  Args: Simplify<
    Omit<PushArgs, 'push'> & Omit<PressedButtonArgs, 'push'> & ButtonArgs & { push?: ToggleFn }
  >;
  Blocks: ButtonBlocks;
}

export const Button = {} as unknown as TOC<ButtonSignature>;
`.trim()
    });

    const file = path.join(fix.base, 'app/button.gts');
    const sigs = await parseSignatures([file], {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });
    const sig = sigs['app/button.gts'].Button;

    // Executed through the checker — no matter how the signature is composed
    expect(Object.keys(sig.args).sort()).toEqual([
      'href',
      'importance',
      'intent',
      'pressed',
      'push'
    ]);

    expect(sig.args.href).toMatchObject({
      required: false,
      type: { category: 'string', raw: 'string' }
    });
    expect(sig.args.pressed).toMatchObject({
      required: false,
      description: 'Whether the button is pressed'
    });
    expect(sig.args.push).toMatchObject({ required: false, type: { category: 'function' } });
    expect(sig.args.importance).toMatchObject({
      type: { category: 'enum', options: ['normal', 'supreme'] }
    });

    expect(Object.keys(sig.blocks).sort()).toEqual(['before', 'default']);
    expect(sig.blocks.default.description).toBe('The label for the button');
    expect(sig.blocks.before.description).toBe('A slot in front of the label');
    expect(sig.element).toBe('HTMLButtonElement | HTMLAnchorElement | HTMLSpanElement');
  });

  test('executes handcrafted types heuristics cannot cover', async () => {
    using fix = fixture({
      'filter.gts': `
import type { TOC } from '@ember/component/template-only';

interface Data {
  name: string;
  age: number;
  greet(): void;
}

/** Keeps only non-function members */
type DataValues<T> = {
  [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: T[K];
};

type IsString<T> = T extends string ? true : false;

export interface FilterSignature {
  Element: HTMLElement;
  Args: {
    data: DataValues<Data>;
    /**
     * Whether names match
     *
     * @defaultValue false
     */
    strict: IsString<string>;
    query: \`\${'a' | 'b'}-suffix\`;
  };
  Blocks: { default: [] };
}

export const Filter = {} as unknown as TOC<FilterSignature>;
`.trim()
    });

    const file = path.join(fix.base, 'app/filter.gts');
    const sigs = await parseSignatures([file], {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });
    const args = sigs['app/filter.gts'].Filter.args;

    // Conditional/mapped types executed by the checker
    expect(args.data.type.category).toBe('object');
    expect(args.data.type.properties).toHaveProperty('name');
    expect(args.data.type.properties).toHaveProperty('age');
    expect(args.data.type.properties).not.toHaveProperty('greet');

    expect(args.strict.type.raw).toBe('true');
    expect(args.strict.defaultValue).toBe('false');
    expect(args.strict.description).toBe('Whether names match');

    expect(args.query.type.raw).toBe('"a-suffix" | "b-suffix"');
  });

  test('supports inline TOC<{ ... }> signatures', async () => {
    using fix = fixture({
      'section.gts': `
import type { TOC } from '@ember/component/template-only';

export const Section = {} as unknown as TOC<{
  Element: HTMLElement;
  Args: {
    title?: string;
    /**
     * The level of the component, 1-6 as in h1 to h6
     *
     * @defaultValue 2
     */
    level?: string;
  };
  Blocks: {
    default: [];
  };
}>;
`.trim()
    });

    const file = path.join(fix.base, 'app/section.gts');
    const sigs = await parseSignatures([file], {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });
    const sig = sigs['app/section.gts'].Section;

    expect(Object.keys(sig.args).sort()).toEqual(['level', 'title']);
    expect(sig.args.level.defaultValue).toBe('2');
    expect(sig.args.level.description).toBe('The level of the component, 1-6 as in h1 to h6');
    expect(Object.keys(sig.blocks)).toEqual(['default']);
    expect(sig.element).toBe('HTMLElement');
  });

  test('extracts block param componentRefs with WithBoundArgs modifiers', async () => {
    using fix = fixture({
      'option.gts': `
import Component from '@glimmer/component';

import type { WithBoundArgs } from '@glint/template';

export interface OptionSignature {
  Element: HTMLOptionElement;
  Args: { value: string };
}

export default class Option extends Component<OptionSignature> {}
`.trim(),
      'list.gts': `
import Component from '@glimmer/component';

import type { WithBoundArgs } from '@glint/template';

import Option from './option';

interface ListSignature {
  Element: HTMLDivElement;
  Blocks: {
    default: [
      {
        /** An option row */
        Option: WithBoundArgs<typeof Option, 'isSelected' | 'registerItem'>;
      }
    ];
  };
}

export default class List extends Component<ListSignature> {}
`.trim()
    });

    const files = ['list.gts', 'option.gts'].map((f) => path.join(fix.base, 'app', f));
    const sigs = await parseSignatures(files, {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });

    const list = sigs['app/list.gts'][/* default */ 'List'] ?? sigs['app/list.gts']['__DEFAULT__'];
    const blockParam = (list.blocks.default!.params[0] as HashBlockParam).Option!;

    expect(blockParam.name).toBe('Option');
    expect(blockParam.description).toBe('An option row');
    expect(blockParam.componentRef).toMatchObject({
      filePath: 'app/option.gts',
      exportName: '__DEFAULT__'
    });
    expect(blockParam.componentRef?.modifiers).toEqual([
      { name: 'WithBoundArgs', typeArgs: ['isSelected', 'registerItem'] }
    ]);
  });

  test('handles class components and generic passthrough', async () => {
    using fix = fixture({
      'list.gts': `
import Component from '@glimmer/component';

interface ListSignature<V> {
  Element: HTMLDivElement;
  Args: {
    items: V[];
    activateItem: (value: V) => void;
  };
}

export default class List<V> extends Component<ListSignature<V>> {}
`.trim()
    });

    const file = path.join(fix.base, 'app/list.gts');
    const sigs = await parseSignatures([file], {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });
    const sig = sigs['app/list.gts'][/* default */ '__DEFAULT__'];

    expect(sig.args.items.required).toBe(true);
    expect(sig.args.items.type.category).toBe('array');
    expect(sig.args.activateItem.type.category).toBe('function');
    expect(sig.element).toBe('HTMLDivElement');
  });

  test('returns empty map for files without components', async () => {
    using fix = fixture({
      'util.ts': `
export function add(a: number, b: number): number {
  return a + b;
}
`.trim()
    });

    const file = path.join(fix.base, 'app/util.ts');
    const sigs = await parseSignatures([file], {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });

    expect(sigs).toEqual({});
  });

  test('rejects a local type named TOC (no import origin)', async () => {
    using fix = fixture({
      'lookalike.gts': `
// A local shim — NOT imported from '@ember/component/template-only'
type TOC<T> = { [K in keyof T]: T[K] };

export interface LookalikeSignature {
  Element: HTMLElement;
  Args: { label: string };
}

export const Lookalike = {} as unknown as TOC<LookalikeSignature>;
`.trim()
    });

    const file = path.join(fix.base, 'app/lookalike.gts');
    const sigs = await parseSignatures([file], {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });

    expect(sigs).toEqual({});
  });

  test('accepts renamed imports of the canonical wrapper', async () => {
    using fix = fixture({
      'renamed.gts': `
import type { TOC as TemplateOnlyComponent } from '@ember/component/template-only';

export interface RenamedSignature {
  Element: HTMLElement;
  Args: { label: string };
}

export const Renamed = {} as unknown as TemplateOnlyComponent<RenamedSignature>;
`.trim()
    });

    const file = path.join(fix.base, 'app/renamed.gts');
    const sigs = await parseSignatures([file], {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });
    const sig = sigs['app/renamed.gts'].Renamed;

    expect(sig.args.label).toMatchObject({ required: true });
    expect(sig.element).toBe('HTMLElement');
  });

  test('rejects a class extending a local Component lookalike', async () => {
    using fix = fixture({
      'fake-component.ts': `
export default class Component<S> {
  readonly args!: S;
}
`.trim(),
      'local.gts': `
import Component from '../fake-component';

interface LocalSignature {
  Element: HTMLElement;
  Args: { label: string };
}

export default class Local extends Component<LocalSignature> {}
`.trim()
    });

    const files = ['local.gts', 'fake-component.ts'].map((f) => path.join(fix.base, 'app', f));
    const sigs = await parseSignatures(files, {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });

    expect(sigs).toEqual({});
  });

  test('extracts modifiers from a renamed WithBoundArgs import', async () => {
    using fix = fixture({
      'option.gts': `
import Component from '@glimmer/component';

export interface OptionSignature {
  Element: HTMLOptionElement;
  Args: { value: string };
}

export default class Option extends Component<OptionSignature> {}
`.trim(),
      'list.gts': `
import Component from '@glimmer/component';

import type { WithBoundArgs as Bound } from '@glint/template';

import Option from './option';

interface ListSignature {
  Blocks: {
    default: [
      {
        Option: Bound<typeof Option, 'isSelected'>;
      }
    ];
  };
}

export default class List extends Component<ListSignature> {}
`.trim()
    });

    const files = ['list.gts', 'option.gts'].map((f) => path.join(fix.base, 'app', f));
    const sigs = await parseSignatures(files, {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });

    const list = sigs['app/list.gts']['__DEFAULT__'];
    const param = (list.blocks.default!.params[0] as HashBlockParam).Option!;

    expect(param.componentRef).toMatchObject({
      filePath: 'app/option.gts',
      exportName: '__DEFAULT__'
    });
    expect(param.componentRef?.modifiers).toEqual([
      { name: 'WithBoundArgs', typeArgs: ['isSelected'] }
    ]);
  });

  test('rejects TOC imported from an invalid location', async () => {
    using fix = fixture({
      // A resolvable, export-compatible module — but the WRONG origin
      'lookalike.ts': `
export interface LookalikeSignature {
  Element: HTMLElement;
  Args: { label: string };
}

export type TOC<T> = { [K in keyof T]: T[K] };

export const Lookalike = {} as unknown as TOC<LookalikeSignature>;
`.trim(),
      'consumer.gts': `
import type { TOC } from '../lookalike';

export interface ConsumerSignature {
  Element: HTMLElement;
  Args: { label: string };
}

export const Consumer = {} as unknown as TOC<ConsumerSignature>;
`.trim()
    });

    const files = ['consumer.gts', 'lookalike.ts'].map((f) => path.join(fix.base, 'app', f));
    const sigs = await parseSignatures(files, {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });

    expect(sigs['app/consumer.gts']).toBeUndefined();
  });

  test('rejects non-wrapper exports from the canonical module', async () => {
    // `TOC` is a wrapper; other exports of @ember/component/template-only
    // must not turn a variable into a component.
    using fix = fixture({
      'misuse.gts': `
import type { EmptyObject } from '@ember/component/template-only';

export interface MisuseSignature {
  Element: HTMLElement;
}

export const Misuse = {} as unknown as EmptyObject<MisuseSignature>;
`.trim()
    });

    const file = path.join(fix.base, 'app/misuse.gts');
    const sigs = await parseSignatures([file], {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });

    expect(sigs).toEqual({});
  });

  test('resolves componentRefs for template-only subcomponents in a yield hash', async () => {
    using fix = fixture({
      // A template-only component defined as an inline TOC var
      'sectioned-page.gts': `
import type { TOC } from '@ember/component/template-only';

export interface SectionSignature {
  Element: HTMLDivElement;
  Args: { title?: string };
  Blocks: { default: [] };
}

export const Section = {} as unknown as TOC<SectionSignature>;

export interface SectionedPageSignature {
  Element: HTMLElement;
  Args: {};
  Blocks: {
    default: [{ Section: typeof Section }];
  };
}

export const SectionedPage = {} as unknown as TOC<SectionedPageSignature>;
`.trim()
    });

    const file = path.join(fix.base, 'app/sectioned-page.gts');
    const sigs = await parseSignatures([file], {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });
    const page = sigs['app/sectioned-page.gts'].SectionedPage;
    const param = (page.blocks.default!.params[0] as HashBlockParam).Section!;

    expect(param.componentRef).toBeDefined();
    expect(param.componentRef).toMatchObject({
      filePath: 'app/sectioned-page.gts',
      exportName: 'Section'
    });
  });

  test('resolves componentRefs for template-only subcomponents imported from another file', async () => {
    using fix = fixture({
      'section.gts': `
<template>
  <div ...attributes>{{yield}}</div>
</template>
`.trim(),
      'sectioned-page.gts': `
import type { TOC } from '@ember/component/template-only';

import Section from './section.gts';

export interface SectionedPageSignature {
  Element: HTMLElement;
  Args: {};
  Blocks: {
    default: [{ Section: typeof Section }];
  };
}

export const SectionedPage = {} as unknown as TOC<SectionedPageSignature>;
`.trim()
    });

    const files = ['section.gts', 'sectioned-page.gts'].map((f) =>
      path.join(fix.base, 'app', f)
    );
    const sigs = await parseSignatures(files, {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });
    const page = sigs['app/sectioned-page.gts'].SectionedPage;
    const param = (page.blocks.default!.params[0] as HashBlockParam).Section!;

    expect(param.componentRef).toBeDefined();
  });

  test('extracts signature through `satisfies TOC<Signature>` with alias export', async () => {
    using fix = fixture({
      'header.gts': `
import type { TOC } from '@ember/component/template-only';

export interface Signature {
  Args: {
    user?: { name: string };
    login: () => void;
    logout: () => void;
  };
}

const H = <template>
  <header>Welcome</header>
</template> satisfies TOC<Signature>;

export { H as Header };
`.trim()
    });

    const file = path.join(fix.base, 'app/header.gts');
    const sigs = await parseSignatures([file], {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });
    const sig = sigs['app/header.gts'].Header;

    expect(Object.keys(sig.args).sort()).toEqual(['login', 'logout', 'user']);
    expect(sig.args.user.required).toBe(false);
    expect(sig.args.login.type.category).toBe('function');
  });

  test('keys aliased re-exports by their export name', async () => {
    using fix = fixture({
      'card.gts': `
import type { TOC } from '@ember/component/template-only';

export interface CardSignature {
  Element: HTMLDivElement;
  Blocks: {
    header?: [];
    body?: [];
  };
}

const Card: TOC<CardSignature> = <template>
  <div class="card">{{yield}}</div>
</template>;

export { Card as CardExport };
`.trim()
    });

    const file = path.join(fix.base, 'app/card.gts');
    const sigs = await parseSignatures([file], {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });

    // Keyed by the EXPORT name (`CardExport`), not the internal name (`Card`)
    expect(sigs['app/card.gts'].CardExport).toBeDefined();
    expect(sigs['app/card.gts'].CardExport.blocks).toHaveProperty('header');
  });

  test('keys plain re-exports by their export name', async () => {
    using fix = fixture({
      'greeting.gts': `
import type { TOC } from '@ember/component/template-only';

interface GreetingSignature {
  Element: HTMLDivElement;
  Args: {
    name: string;
  };
}

const Greeting: TOC<GreetingSignature> = <template>
  <div>Hello {{@name}}</div>
</template>;

export { Greeting };
`.trim()
    });

    const file = path.join(fix.base, 'app/greeting.gts');
    const sigs = await parseSignatures([file], {
      tsconfigFile: path.join(fix.base, 'tsconfig.json')
    });
    const sig = sigs['app/greeting.gts'].Greeting;

    expect(sig.args.name.required).toBe(true);
    expect(sig.args.name.type.category).toBe('string');
    expect(sig.element).toBe('HTMLDivElement');
  });

  // https://github.com/ember-integrations/ember-storybook/issues/46
  describe('unfolds local (non-exported) components in block params', () => {
    test('resolves a local class referenced via WithBoundArgs<typeof X> and extracts its signature', async () => {
      using fix = fixture({
        'radio-button-group.gts': `
import Component from '@glimmer/component';

import type { WithBoundArgs } from '@glint/template';

interface RadioButtonSignature {
  Element: HTMLButtonElement;
  Args: {
    value: string;
    register: () => void;
    isSelected: () => boolean;
  };
}

class RadioButton extends Component<RadioButtonSignature> {}

interface RadioButtonGroupSignature {
  Element: HTMLDivElement;
  Blocks: {
    default: [
      {
        Button: WithBoundArgs<typeof RadioButton, 'register' | 'isSelected'>;
      }
    ];
  };
}

export default class RadioButtonGroup extends Component<RadioButtonGroupSignature> {}
`.trim()
      });

      const file = path.join(fix.base, 'app/radio-button-group.gts');
      const sigs = await parseSignatures([file], {
        tsconfigFile: path.join(fix.base, 'tsconfig.json')
      });

      const group = sigs['app/radio-button-group.gts'][Default];
      const blockParam = (group.blocks.default!.params[0] as HashBlockParam).Button!;

      // Unfolds the local component: marked `local`, pointing at the local name
      expect(blockParam.componentRef).toMatchObject({
        filePath: 'app/radio-button-group.gts',
        exportName: 'RadioButton',
        local: true
      });
      expect(blockParam.componentRef?.modifiers).toEqual([
        { name: 'WithBoundArgs', typeArgs: ['register', 'isSelected'] }
      ]);

      // Local component signature is extracted so the subcomponent has content
      expect(sigs['app/radio-button-group.gts'].RadioButton).toBeDefined();
      expect(Object.keys(sigs['app/radio-button-group.gts'].RadioButton.args).sort()).toEqual([
        'isSelected',
        'register',
        'value'
      ]);
    });

    test('resolves a local TOC const referenced via typeof X and extracts its signature', async () => {
      using fix = fixture({
        'navigation-list.gts': `
import type { TOC } from '@ember/component/template-only';

const Title: TOC<{ Blocks: { default: [] } }> = <template>
  <span part="title">{{yield}}</span>
</template>;

export interface NavigationListSignature {
  Element: HTMLElement;
  Blocks: {
    default?: [{ Title: typeof Title }];
  };
}

export const NavigationList: TOC<NavigationListSignature> = <template>
  <nav>{{yield (hash Title=Title)}}</nav>
</template>;
`.trim()
      });

      const file = path.join(fix.base, 'app/navigation-list.gts');
      const sigs = await parseSignatures([file], {
        tsconfigFile: path.join(fix.base, 'tsconfig.json')
      });

      const blockParam = (sigs['app/navigation-list.gts'].NavigationList.blocks.default!.params[0] as HashBlockParam)
        .Title!;

      expect(blockParam.componentRef).toMatchObject({
        filePath: 'app/navigation-list.gts',
        exportName: 'Title',
        local: true
      });

      expect(sigs['app/navigation-list.gts'].Title).toBeDefined();
      expect(Object.keys(sigs['app/navigation-list.gts'].Title.blocks)).toEqual(['default']);
    });

    test('unfolds ComponentLike<typeof X> in a block param', async () => {
      using fix = fixture({
        'app-header.gts': `
import type { TOC } from '@ember/component/template-only';
import type { ComponentLike } from '@glint/template';

const NavItem: TOC<{ Args: { label: string } }> = <template>
  {{yield}}
</template>;

export interface AppHeaderSignature {
  Element: HTMLElement;
  Blocks: {
    aux?: [{ Item: ComponentLike<typeof NavItem> }];
  };
}

export const AppHeader: TOC<AppHeaderSignature> = <template>
  <header>{{yield (hash Item=NavItem) to="aux"}}</header>
</template>;
`.trim()
      });

      const file = path.join(fix.base, 'app/app-header.gts');
      const sigs = await parseSignatures([file], {
        tsconfigFile: path.join(fix.base, 'tsconfig.json')
      });

      const blockParam = (sigs['app/app-header.gts'].AppHeader.blocks.aux!.params[0] as HashBlockParam).Item!;

      expect(blockParam.componentRef).toMatchObject({
        filePath: 'app/app-header.gts',
        exportName: 'NavItem',
        local: true
      });
    });

    test('does not unfold a local wrapper shim named like a component wrapper', async () => {
      using fix = fixture({
        'shim.gts': `
import type { TOC } from '@ember/component/template-only';

// A LOCAL type alias — NOT the canonical wrapper from
// '@ember/component/template-only'
type ComponentLike<T> = { [K in keyof T]: T[K] };

const Item: TOC<{ Args: { label: string } }> = <template>
  {{yield}}
</template>;

export interface ShimSignature {
  Blocks: {
    default?: [{ Item: ComponentLike<typeof Item> }];
  };
}

export const Shim: TOC<ShimSignature> = <template>
  {{yield (hash Item=Item)}}
</template>;
`.trim()
      });

      const file = path.join(fix.base, 'app/shim.gts');
      const sigs = await parseSignatures([file], {
        tsconfigFile: path.join(fix.base, 'tsconfig.json')
      });

      const blockParam = (sigs['app/shim.gts'].Shim.blocks.default!.params[0] as HashBlockParam).Item!;

      // The local `ComponentLike` shim must not be treated as a wrapper
      expect(blockParam.componentRef).toBeUndefined();
    });

    test('extracts the signature of a cross-file component referenced via typeof X', async () => {
      using fix = fixture({
        'nav-link.gts': `
import type { TOC } from '@ember/component/template-only';

export interface NavLinkSignature {
  Element: HTMLAnchorElement;
  Args: { href?: string };
}

export const NavLink: TOC<NavLinkSignature> = <template>
  <a ...attributes>{{yield}}</a>
</template>;
`.trim(),
        'navigation-list.gts': `
import type { TOC } from '@ember/component/template-only';

import { NavLink } from './nav-link.gts';

export interface NavigationListSignature {
  Element: HTMLElement;
  Blocks: {
    default?: [{ Item: typeof NavLink }];
  };
}

export const NavigationList: TOC<NavigationListSignature> = <template>
  <nav>{{yield (hash Item=NavLink)}}</nav>
</template>;
`.trim()
      });

      // Only the story component is an entry point — NavLink is transitive
      const file = path.join(fix.base, 'app/navigation-list.gts');
      const sigs = await parseSignatures([file], {
        tsconfigFile: path.join(fix.base, 'tsconfig.json')
      });

      const blockParam = (sigs['app/navigation-list.gts'].NavigationList.blocks.default!.params[0] as HashBlockParam)
        .Item!;

      // Cross-file refs keep the component's own name (not `local`)
      expect(blockParam.componentRef).toMatchObject({
        filePath: 'app/nav-link.gts',
        exportName: 'NavLink'
      });
      expect(blockParam.componentRef?.local).toBeUndefined();

      // The referenced file's signature is extracted so NavLink isn't empty
      expect(sigs['app/nav-link.gts'].NavLink).toBeDefined();
      expect(sigs['app/nav-link.gts'].NavLink.element).toBe('HTMLAnchorElement');
    });
  });
});
