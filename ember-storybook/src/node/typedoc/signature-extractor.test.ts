import { describe, expect, test } from 'vitest';

import { Default } from '../shared';
import { extractSignatures } from './signature-extractor';

// ── Fixtures ──────────────────────────────────────────────────────

const FIXTURE_FULL = {
  id: 1,
  variant: 'project',
  name: 'test-project',
  kind: 1,
  schemaVersion: '2.0',
  symbolIdMap: {},
  files: { entries: {}, reflections: {} },
  children: [
    // Module containing Card component + CardSignature
    {
      id: 2,
      variant: 'declaration',
      name: 'src/components/card.gts',
      kind: 2, // Module
      children: [
        {
          id: 3,
          variant: 'declaration',
          name: 'Card',
          kind: 128, // Class
          extendedTypes: [
            {
              type: 'reference',
              name: 'Component',
              typeArguments: [
                {
                  type: 'reference',
                  name: 'CardSignature',
                  target: 4
                }
              ]
            }
          ],
          sources: [{ fileName: '/src/components/card.gts', line: 1 }]
        },
        // Reference reflection (export default class) — must be skipped
        {
          id: 22,
          variant: 'reference',
          name: 'default',
          kind: 128,
          target: 3,
          sources: [{ fileName: '/src/components/card.gts', line: 1 }]
        },
        {
          id: 4,
          variant: 'declaration',
          name: 'CardSignature',
          kind: 256, // Interface
          children: [
            {
              id: 5,
              variant: 'declaration',
              name: 'Args',
              kind: 1024, // Property
              flags: {},
              type: {
                type: 'reflection',
                declaration: {
                  id: 50,
                  variant: 'declaration',
                  name: '__type',
                  kind: 65_536, // TypeLiteral
                  children: [
                    {
                      id: 6,
                      variant: 'declaration',
                      name: 'greeting',
                      kind: 1024,
                      flags: {},
                      type: { type: 'intrinsic', name: 'string' },
                      comment: {
                        summary: [{ kind: 'text', text: 'The greeting to display' }]
                      }
                    },
                    {
                      id: 7,
                      variant: 'declaration',
                      name: 'count',
                      kind: 1024,
                      flags: {},
                      type: { type: 'intrinsic', name: 'number' },
                      comment: {
                        summary: [{ kind: 'text', text: 'Number of items' }]
                      }
                    },
                    {
                      id: 8,
                      variant: 'declaration',
                      name: 'push',
                      kind: 1024,
                      flags: { isOptional: true },
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 51,
                          variant: 'declaration',
                          name: '__type',
                          kind: 65_536,
                          signatures: [
                            {
                              id: 52,
                              variant: 'signature',
                              name: '__type',
                              kind: 4096,
                              parameters: [
                                {
                                  id: 53,
                                  variant: 'param',
                                  name: 'value',
                                  kind: 32_768,
                                  type: { type: 'intrinsic', name: 'string' }
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
            },
            {
              id: 9,
              variant: 'declaration',
              name: 'Blocks',
              kind: 1024,
              flags: {},
              type: {
                type: 'reflection',
                declaration: {
                  id: 60,
                  variant: 'declaration',
                  name: '__type',
                  kind: 65_536,
                  children: [
                    {
                      id: 10,
                      variant: 'declaration',
                      name: 'header',
                      kind: 1024,
                      flags: {},
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 61,
                          variant: 'declaration',
                          name: '__type',
                          kind: 65_536,
                          children: [
                            {
                              id: 11,
                              variant: 'param',
                              name: 'title',
                              kind: 32_768,
                              type: { type: 'intrinsic', name: 'string' }
                            },
                            {
                              id: 12,
                              variant: 'param',
                              name: 'subtitle',
                              kind: 32_768,
                              type: { type: 'intrinsic', name: 'string' }
                            }
                          ]
                        }
                      }
                    },
                    {
                      id: 13,
                      variant: 'declaration',
                      name: 'footer',
                      kind: 1024,
                      flags: {},
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 62,
                          variant: 'declaration',
                          name: '__type',
                          kind: 65_536,
                          children: []
                        }
                      }
                    },
                    {
                      id: 23,
                      variant: 'declaration',
                      name: 'body',
                      kind: 1024,
                      flags: {},
                      type: {
                        type: 'tuple',
                        elements: [
                          {
                            type: 'namedTupleMember',
                            name: 'item',
                            element: { type: 'intrinsic', name: 'string' }
                          },
                          {
                            type: 'namedTupleMember',
                            name: 'index',
                            element: { type: 'intrinsic', name: 'number' }
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            },
            {
              id: 14,
              variant: 'declaration',
              name: 'Element',
              kind: 1024,
              flags: {},
              type: { type: 'reference', name: 'HTMLDivElement' },
              comment: {
                summary: [{ kind: 'text', text: 'The root element' }]
              }
            },
            {
              id: 15,
              variant: 'declaration',
              name: 'Style',
              kind: 1024,
              flags: {},
              type: {
                type: 'reflection',
                declaration: {
                  id: 70,
                  variant: 'declaration',
                  name: '__type',
                  kind: 65_536,
                  children: [
                    {
                      id: 16,
                      variant: 'declaration',
                      name: 'CustomProperties',
                      kind: 1024,
                      flags: {},
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 71,
                          variant: 'declaration',
                          name: '__type',
                          kind: 65_536,
                          children: [
                            {
                              id: 17,
                              variant: 'declaration',
                              name: '--color',
                              kind: 1024,
                              flags: {},
                              type: { type: 'stringLiteral', value: 'primary' }
                            },
                            {
                              id: 18,
                              variant: 'declaration',
                              name: '--spacing',
                              kind: 1024,
                              flags: {},
                              type: { type: 'stringLiteral', value: 'md' }
                            }
                          ]
                        }
                      }
                    },
                    {
                      id: 19,
                      variant: 'declaration',
                      name: 'Parts',
                      kind: 1024,
                      flags: {},
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 72,
                          variant: 'declaration',
                          name: '__type',
                          kind: 65_536,
                          children: [
                            {
                              id: 20,
                              variant: 'declaration',
                              name: 'container',
                              kind: 1024,
                              flags: {},
                              type: { type: 'stringLiteral', value: 'The outer wrapper' }
                            },
                            {
                              id: 21,
                              variant: 'declaration',
                              name: 'header',
                              kind: 1024,
                              flags: {},
                              type: { type: 'stringLiteral', value: 'The header area' }
                            }
                          ]
                        }
                      }
                    }
                  ]
                }
              }
            }
          ]
        }
      ]
    },
    // TOC variable referencing the same signature in a different file
    {
      id: 30,
      variant: 'declaration',
      name: 'MyCard',
      kind: 32, // Variable
      type: {
        type: 'reference',
        name: 'TOC',
        typeArguments: [{ type: 'reference', name: 'CardSignature', target: 4 }]
      },
      sources: [{ fileName: '/src/components/my-card.gts', line: 1 }]
    }
  ]
} as const;

// ── Tests ─────────────────────────────────────────────────────────

describe('extractSignatures', () => {
  test('extracts full signature from class extending Component<Signature>', () => {
    const result = extractSignatures(FIXTURE_FULL as never, '');

    const keys = Object.keys(result);

    expect(keys).toContain('/src/components/card.gts');

    const sig = result['/src/components/card.gts'].Card;

    expect(sig.args).toHaveProperty('greeting');
    expect(sig.args).toHaveProperty('count');
    expect(sig.args).toHaveProperty('push');

    // Args
    expect(sig.args.greeting).toEqual({
      type: 'string',
      required: true,
      description: 'The greeting to display',
      defaultValue: undefined
    });
    expect(sig.args.count).toEqual({
      type: 'number',
      required: true,
      description: 'Number of items',
      defaultValue: undefined
    });
    expect(sig.args.push.required).toBe(false);
    expect(sig.args.push.type).toMatch(/^\(value: string\) => void$/);

    // Blocks
    expect(sig.blocks).toHaveProperty('header');
    expect(sig.blocks).toHaveProperty('footer');
    expect(sig.blocks).toHaveProperty('body');
    expect(sig.blocks.header.params).toEqual([
      { name: 'title', type: 'string', componentRef: undefined, description: '' },
      { name: 'subtitle', type: 'string', componentRef: undefined, description: '' }
    ]);
    expect(sig.blocks.footer.params).toEqual([]);
    expect(sig.blocks.body.params).toEqual([
      { name: 'item', type: 'string', componentRef: undefined },
      { name: 'index', type: 'number', componentRef: undefined }
    ]);

    // Element
    expect(sig.element).toBe('HTMLDivElement');

    // Style
    expect(sig.style.customProperties).toEqual({
      '--color': 'primary',
      '--spacing': 'md'
    });
    expect(sig.style.parts).toEqual({
      container: 'The outer wrapper',
      header: 'The header area'
    });
  });

  test('associates signature via TOC<Signature> variable', () => {
    const result = extractSignatures(FIXTURE_FULL as never, '');

    // TOC-based component in a separate file
    const sigTOC = result['/src/components/my-card.gts'].MyCard;

    expect(sigTOC.args.greeting).toBeDefined();

    // Both files share same signature shape
    expect(Object.keys(result)).toHaveLength(2);
  });

  test('returns empty map when no signatures found', () => {
    const emptyProject = {
      id: 1,
      variant: 'project',
      name: 'empty',
      kind: 1,
      children: []
    };
    const result = extractSignatures(emptyProject, '');

    expect(result).toEqual({});
  });

  test('handles interfaces named just "Signature" (not XxxSignature)', () => {
    const fixture = {
      id: 1,
      variant: 'project',
      name: 'test',
      kind: 1,
      children: [
        {
          id: 10,
          variant: 'declaration',
          name: 'src/button.gts',
          kind: 2,
          children: [
            {
              id: 11,
              variant: 'declaration',
              name: 'Button',
              kind: 128,
              extendedTypes: [
                {
                  type: 'reference',
                  name: 'Component',
                  typeArguments: [{ type: 'reference', name: 'Signature', target: 12 }]
                }
              ],
              sources: [{ fileName: 'src/button.gts', line: 1 }]
            },
            {
              id: 12,
              variant: 'declaration',
              name: 'Signature',
              kind: 256,
              children: [
                {
                  id: 13,
                  variant: 'declaration',
                  name: 'Args',
                  kind: 1024,
                  flags: {},
                  type: {
                    type: 'reflection',
                    declaration: {
                      id: 14,
                      variant: 'declaration',
                      name: '__type',
                      kind: 65_536,
                      children: [
                        {
                          id: 15,
                          variant: 'declaration',
                          name: 'label',
                          kind: 1024,
                          flags: {},
                          type: { type: 'intrinsic', name: 'string' },
                          comment: { summary: [{ kind: 'text', text: 'Button label' }] }
                        }
                      ]
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    };

    const result = extractSignatures(fixture, '');

    expect(result['src/button.gts'].Button.args).toHaveProperty('label');
  });

  test('skips reference reflections (variant=reference) to avoid overwriting component names with "default"', () => {
    // The fixture includes a reference reflection (id=22, name="default")
    // pointing at Card. Without the skip, it would add an entry with
    // componentName "default", overwriting the "Card" entry.
    const result = extractSignatures(FIXTURE_FULL as never, '');
    const entries = Object.keys(result);
    const hasDefault = entries.some((key) => Object.keys(result[key]).includes('default'));

    expect(hasDefault).toBe(false);
    expect(result['/src/components/card.gts'].Card).toBeDefined();
  });

  test('uses Default key when reflection name is "default"', () => {
    const fixture = {
      id: 1,
      variant: 'project',
      name: 'test',
      kind: 1,
      children: [
        {
          id: 2,
          variant: 'declaration',
          name: 'src/greeting.gts',
          kind: 2,
          children: [
            {
              id: 3,
              variant: 'declaration',
              name: 'default',
              kind: 128,
              extendedTypes: [
                {
                  type: 'reference',
                  name: 'Component',
                  typeArguments: [{ type: 'reference', name: 'GreetingSignature', target: 4 }]
                }
              ],
              sources: [{ fileName: 'src/greeting.gts', line: 1 }]
            },
            {
              id: 4,
              variant: 'declaration',
              name: 'GreetingSignature',
              kind: 256,
              children: [
                {
                  id: 5,
                  variant: 'declaration',
                  name: 'Args',
                  kind: 1024,
                  flags: {},
                  type: {
                    type: 'reflection',
                    declaration: {
                      id: 6,
                      variant: 'declaration',
                      name: '__type',
                      kind: 65_536,
                      children: [
                        {
                          id: 7,
                          variant: 'declaration',
                          name: 'name',
                          kind: 1024,
                          flags: {},
                          type: { type: 'intrinsic', name: 'string' }
                        }
                      ]
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    };

    const result = extractSignatures(fixture, '');

    expect(result['src/greeting.gts'][Default]).toBeDefined();
    expect(result['src/greeting.gts'][Default].args.name.type).toBe('string');
  });

  test('resolves componentRef exportName to Default for default-export subcomponents', () => {
    const fixture = {
      id: 1,
      variant: 'project',
      name: 'test',
      kind: 1,
      children: [
        {
          id: 10,
          variant: 'declaration',
          name: 'src/child.gts',
          kind: 2,
          children: [
            {
              id: 11,
              variant: 'declaration',
              name: 'default',
              kind: 128,
              extendedTypes: [
                {
                  type: 'reference',
                  name: 'Component',
                  typeArguments: [{ type: 'reference', name: 'ChildSignature', target: 13 }]
                }
              ],
              sources: [{ fileName: 'src/child.gts', line: 1 }]
            },
            {
              id: 13,
              variant: 'declaration',
              name: 'ChildSignature',
              kind: 256,
              children: []
            }
          ]
        },
        {
          id: 20,
          variant: 'declaration',
          name: 'src/parent.gts',
          kind: 2,
          children: [
            {
              id: 21,
              variant: 'declaration',
              name: 'Parent',
              kind: 128,
              extendedTypes: [
                {
                  type: 'reference',
                  name: 'Component',
                  typeArguments: [{ type: 'reference', name: 'ParentSignature', target: 22 }]
                }
              ],
              sources: [{ fileName: 'src/parent.gts', line: 1 }]
            },
            {
              id: 22,
              variant: 'declaration',
              name: 'ParentSignature',
              kind: 256,
              children: [
                {
                  id: 23,
                  variant: 'declaration',
                  name: 'Blocks',
                  kind: 1024,
                  type: {
                    type: 'reflection',
                    declaration: {
                      id: 24,
                      variant: 'declaration',
                      name: '__type',
                      kind: 65_536,
                      children: [
                        {
                          id: 25,
                          variant: 'declaration',
                          name: 'content',
                          kind: 1024,
                          type: {
                            type: 'reflection',
                            declaration: {
                              id: 26,
                              variant: 'declaration',
                              name: '__type',
                              kind: 65_536,
                              children: [
                                {
                                  id: 27,
                                  variant: 'declaration',
                                  name: 'component',
                                  kind: 1024,
                                  type: {
                                    type: 'reference',
                                    name: 'ChildComp',
                                    target: 11
                                  }
                                }
                              ]
                            }
                          }
                        }
                      ]
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    };

    const result = extractSignatures(fixture, '');
    const parent = result['src/parent.gts'].Parent;
    const blockParam = parent.blocks.content.params[0];

    expect(blockParam.componentRef).toBeDefined();
    expect((blockParam.componentRef as { exportName: string }).exportName).toBe(Default);
    expect((blockParam.componentRef as { filePath: string }).filePath).toBe('src/child.gts');
  });

  test('skips interfaces without Args/Blocks/Element/Style', () => {
    const fixture = {
      id: 1,
      variant: 'project',
      name: 'test',
      kind: 1,
      children: [
        {
          id: 2,
          variant: 'declaration',
          name: 'NotASignature',
          kind: 256,
          children: [
            {
              id: 3,
              variant: 'declaration',
              name: 'foo',
              kind: 1024,
              flags: {},
              type: { type: 'intrinsic', name: 'string' }
            }
          ]
        }
      ]
    };

    const result = extractSignatures(fixture, '');

    expect(result).toEqual({});
  });
});
