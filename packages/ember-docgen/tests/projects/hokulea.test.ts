import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any --
 * The fixture is untyped JSON; assembling synthetic reflections is inherently
 * unsafe. */

import { analyzeTypedoc } from '../../src';

import type { BlockInfo, ComponentSignatureMap } from '../../src';

const FIXTURE_PATH = path.join(import.meta.dirname, '../fixtures/hokulea.json');

function loadHokulea(): Record<string, any> {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, any>;
}

/**
 * Builds a synthetic module shaped like hokulea's `button.gts`, appended to
 * the real fixture. It reuses the fixture's own `PushArgs` interface (id 6,
 * module `push`) and mirrors the composition of the real ButtonSignature:
 *
 *   Args: Simplify<Omit<PushArgs, 'push'> & Omit<PressedButtonArgs, 'push'> &
 *                 ButtonArgs & { push?: ToggleFn }>
 *   Blocks: ButtonBlocks
 *
 * See https://github.com/ember-integrations/ember-storybook/issues/29 and
 * https://github.com/ember-integrations/ember-storybook/issues/39
 */
function withHokuleaButton(project: Record<string, any>): Record<string, any> {
  const fixture = structuredClone(project);

  fixture.children.push({
    id: 100_000,
    name: '-button',
    variant: 'declaration',
    kind: 2,
    children: [
      {
        id: 100_002,
        name: 'PressedButtonArgs',
        variant: 'declaration',
        kind: 256,
        sources: [{ fileName: 'ember/package/src/components/actions/-button.gts', line: 40 }],
        children: [
          {
            id: 100_003,
            name: 'pressed',
            variant: 'declaration',
            kind: 1024,
            flags: { isOptional: true },
            comment: { summary: [{ kind: 'text', text: 'Whether the button is pressed' }] },
            type: { type: 'intrinsic', name: 'boolean' }
          },
          {
            id: 100_004,
            name: 'push',
            variant: 'declaration',
            kind: 1024,
            flags: { isOptional: true },
            comment: { summary: [{ kind: 'text', text: 'Command to invoke' }] },
            type: { type: 'reference', name: 'ToggleFn' }
          }
        ]
      },
      {
        id: 100_010,
        name: 'ButtonArgs',
        variant: 'declaration',
        kind: 256,
        sources: [{ fileName: 'ember/package/src/components/actions/-button.gts', line: 30 }],
        children: [
          {
            id: 100_011,
            name: 'intent',
            variant: 'declaration',
            kind: 1024,
            flags: { isOptional: true },
            type: { type: 'intrinsic', name: 'string' }
          },
          {
            id: 100_012,
            name: 'importance',
            variant: 'declaration',
            kind: 1024,
            flags: { isOptional: true },
            comment: { summary: [{ kind: 'text', text: 'How important the button is' }] },
            type: {
              type: 'union',
              types: [
                { type: 'literal', value: 'normal' },
                { type: 'literal', value: 'supreme' }
              ]
            }
          },
          {
            id: 100_013,
            name: 'spacing',
            variant: 'declaration',
            kind: 1024,
            flags: { isOptional: true },
            type: { type: 'intrinsic', name: 'boolean' }
          }
        ]
      },
      {
        id: 100_020,
        name: 'ButtonBlocks',
        variant: 'declaration',
        kind: 256,
        sources: [{ fileName: 'ember/package/src/components/actions/-button.gts', line: 20 }],
        children: [
          {
            id: 100_021,
            name: 'before',
            variant: 'declaration',
            kind: 1024,
            flags: { isOptional: true },
            comment: { summary: [{ kind: 'text', text: 'A slot in front of the label' }] },
            type: { type: 'tuple' }
          },
          {
            id: 100_022,
            name: 'label',
            variant: 'declaration',
            kind: 1024,
            flags: { isOptional: true },
            comment: { summary: [{ kind: 'text', text: 'The label for the button' }] },
            type: { type: 'tuple' }
          },
          {
            id: 100_023,
            name: 'default',
            variant: 'declaration',
            kind: 1024,
            flags: { isOptional: true },
            comment: { summary: [{ kind: 'text', text: 'The label for the button' }] },
            type: { type: 'tuple' }
          },
          {
            id: 100_024,
            name: 'after',
            variant: 'declaration',
            kind: 1024,
            flags: { isOptional: true },
            comment: { summary: [{ kind: 'text', text: 'A slot after the label' }] },
            type: { type: 'tuple' }
          }
        ]
      },
      {
        id: 100_030,
        name: 'ButtonSignature',
        variant: 'declaration',
        kind: 256,
        sources: [{ fileName: 'ember/package/src/components/actions/button.gts', line: 17 }],
        children: [
          {
            id: 100_031,
            name: 'Element',
            variant: 'declaration',
            kind: 1024,
            type: {
              type: 'union',
              types: [
                { type: 'reference', name: 'HTMLButtonElement' },
                { type: 'reference', name: 'HTMLAnchorElement' },
                { type: 'reference', name: 'HTMLSpanElement' }
              ]
            }
          },
          {
            id: 100_032,
            name: 'Args',
            variant: 'declaration',
            kind: 1024,
            type: {
              type: 'reference',
              target: {
                packageName: 'type-fest',
                packagePath: 'dist/source/simplify.d.ts',
                qualifiedName: 'Simplify'
              },
              typeArguments: [
                {
                  type: 'intersection',
                  types: [
                    {
                      type: 'reference',
                      target: {
                        packageName: 'typescript',
                        packagePath: 'lib/lib.es5.d.ts',
                        qualifiedName: 'Omit'
                      },
                      // References the REAL PushArgs from the hokulea fixture
                      typeArguments: [
                        { type: 'reference', target: 6, name: 'PushArgs' },
                        { type: 'literal', value: 'push' }
                      ],
                      name: 'Omit',
                      package: 'typescript'
                    },
                    {
                      type: 'reference',
                      target: {
                        packageName: 'typescript',
                        packagePath: 'lib/lib.es5.d.ts',
                        qualifiedName: 'Omit'
                      },
                      typeArguments: [
                        { type: 'reference', target: 100_002, name: 'PressedButtonArgs' },
                        { type: 'literal', value: 'push' }
                      ],
                      name: 'Omit',
                      package: 'typescript'
                    },
                    { type: 'reference', target: 100_010, name: 'ButtonArgs' },
                    {
                      type: 'reflection',
                      declaration: {
                        id: 100_033,
                        name: '__type',
                        variant: 'declaration',
                        kind: 65_536,
                        children: [
                          {
                            id: 100_034,
                            name: 'push',
                            variant: 'declaration',
                            kind: 1024,
                            flags: { isOptional: true },
                            comment: {
                              summary: [{ kind: 'text', text: 'Invoked on push' }]
                            },
                            type: {
                              type: 'reflection',
                              declaration: {
                                id: 100_035,
                                name: '__type',
                                variant: 'declaration',
                                kind: 65_536,
                                signatures: [
                                  {
                                    id: 100_036,
                                    name: '__type',
                                    variant: 'signature',
                                    kind: 4096,
                                    parameters: [
                                      {
                                        id: 100_037,
                                        name: 'value',
                                        variant: 'param',
                                        kind: 32_768,
                                        type: { type: 'intrinsic', name: 'boolean' }
                                      }
                                     ],
                                     type: { type: 'intrinsic', name: 'void' }
                                   }
                                 ]
                               }
                             }
                           }
                         ]
                       }
                     }
                   ]
                 }
               ],
               name: 'Simplify'
               }
             },
             {
               id: 100_038,
               name: 'Blocks',
              variant: 'declaration',
              kind: 1024,
              type: { type: 'reference', target: 100_020, name: 'ButtonBlocks' }
            }
          ]
        },
        {
          id: 100_050,
          name: 'Button',
          variant: 'declaration',
          kind: 32,
          flags: { isConst: true },
          sources: [{ fileName: 'ember/package/src/components/actions/button.gts', line: 34 }],
          type: {
            type: 'reference',
            target: {
              packageName: 'ember-source',
              packagePath: 'types/stable/@ember/component/template-only.d.ts',
              qualifiedName: '"@ember/component/template-only".TOC'
            },
            typeArguments: [{ type: 'reference', target: 100_030, name: 'ButtonSignature' }],
            name: 'TOC',
            package: 'ember-source',
            qualifiedName: '"@ember/component/template-only".TOC'
          },
          defaultValue: '...'
        }
      ]
  });

  return fixture;
}

describe('analyzeTypedoc — hokulea project fixture', () => {
  test('processes the real hokulea TypeDoc output without crashing', () => {
    const result = analyzeTypedoc(loadHokulea() as never);

    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  test('raw fixture yields no signatures — its *Signature interfaces are not part of the JSON', () => {
    // The real-world hokulea TypeDoc output references its signature
    // interfaces externally (`qualifiedName: 'ButtonSignature'`) without
    // embedding them. Components must not be fabricated from thin air.
    const result = analyzeTypedoc(loadHokulea() as never);

    expect(result).toEqual({});
  });

  test('flattens a composed signature built from real fixture data (#29 / #39)', () => {
    const result: ComponentSignatureMap = analyzeTypedoc(withHokuleaButton(loadHokulea()) as never);
    const sig = result['ember/package/src/components/actions/button.gts']?.Button;

    expect(sig).toBeDefined();

    // Args merged from: Omit<PushArgs, 'push'> & Omit<PressedButtonArgs, 'push'>
    //                   & ButtonArgs & { push?: ToggleFn }
    expect(Object.keys(sig!.args).sort()).toEqual([
      'href',
      'importance',
      'intent',
      'pressed',
      'push',
      'spacing'
    ]);

    // From the fixture's real PushArgs (via Omit)
    expect(sig!.args.href).toEqual({
      type: { category: 'string', raw: 'string' },
      required: false,
      description: '',
      defaultValue: undefined
    });

    // From PressedButtonArgs (via Omit)
    expect(sig!.args.pressed).toMatchObject({
      required: false,
      description: 'Whether the button is pressed'
    });

    // Overridden by the inline object literal
    expect(sig!.args.push).toMatchObject({
      required: false,
      description: 'Invoked on push',
      type: { category: 'function' }
    });

    // From ButtonArgs
    expect(sig!.args.importance).toEqual({
      type: {
        category: 'enum',
        raw: 'normal | supreme',
        options: ['normal', 'supreme']
      },
      required: false,
      description: 'How important the button is',
      defaultValue: undefined
    });
    expect(sig!.args.intent.required).toBe(false);
    expect(sig!.args.spacing.required).toBe(false);

    // Blocks resolved from the ButtonBlocks reference
    const expectedBlocks = ['after', 'before', 'default', 'label'];

    expect(Object.keys(sig!.blocks).sort()).toEqual(expectedBlocks);

    const blocks: Record<string, BlockInfo> = sig!.blocks;

    expect(blocks.before.params).toEqual([]);
    expect(blocks.before.description).toBe('A slot in front of the label');
    expect(blocks.after.description).toBe('A slot after the label');
    expect(blocks.label.description).toBe('The label for the button');

    // Element union
    expect(sig!.element).toBe('HTMLButtonElement | HTMLAnchorElement | HTMLSpanElement');
  });
});
