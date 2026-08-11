import { describe, expect, test } from 'vitest';

/* eslint-disable @typescript-eslint/no-unsafe-assignment --
 * The fixture is untyped JSON; navigational lookups by ID are inherently unsafe. */
import { Default, analyze } from '../src';

import type { HashBlockParam } from '../src';

// ── Single fixture derived from demo/docs.json ────────────────────────

const FIXTURE = {
  schemaVersion: '2.0',
  id: 0,
  name: 'demo',
  variant: 'project',
  kind: 1,
  children: [
    // ── button module: class "default" extends Component<Signature> ──
    //     Signature has Args + Element (no Blocks, no Style)
    {
      id: 100,
      name: 'button',
      variant: 'declaration',
      kind: 2,
      children: [
        {
          id: 101,
          name: 'default',
          variant: 'declaration',
          kind: 128,
          extendedTypes: [
            {
              type: 'reference',
              target: {
                packageName: '@glimmer/component',
                packagePath: 'dist/index.d.ts',
                qualifiedName: 'default'
              },
              typeArguments: [
                { type: 'reference', target: 110, name: 'Signature', package: 'demo' }
              ],
              name: 'default',
              package: '@glimmer/component'
            }
          ],
          sources: [{ fileName: 'demo/app/components/button.gts', line: 16 }]
        },
        {
          id: 110,
          name: 'Signature',
          variant: 'declaration',
          kind: 256,
          sources: [{ fileName: 'demo/app/components/button.gts', line: 6 }],
          children: [
            {
              id: 111,
              name: 'Args',
              variant: 'declaration',
              kind: 1024,
              type: {
                type: 'reflection',
                declaration: {
                  id: 112,
                  name: '__type',
                  variant: 'declaration',
                  kind: 65_536,
                  children: [
                    {
                      id: 113,
                      name: 'backgroundColor',
                      variant: 'declaration',
                      kind: 1024,
                      flags: { isOptional: true },
                      comment: {
                        summary: [{ kind: 'text', text: 'What background color to use' }]
                      },
                      type: { type: 'intrinsic', name: 'string' }
                    },
                    {
                      id: 114,
                      name: 'label',
                      variant: 'declaration',
                      kind: 1024,
                      comment: { summary: [{ kind: 'text', text: 'Button contents' }] },
                      type: { type: 'intrinsic', name: 'string' }
                    },
                    {
                      id: 115,
                      name: 'primary',
                      variant: 'declaration',
                      kind: 1024,
                      flags: { isOptional: true },
                      comment: {
                        summary: [
                          {
                            kind: 'text',
                            text: 'Is this the principal call to action on the page?'
                          }
                        ]
                      },
                      type: { type: 'intrinsic', name: 'boolean' }
                    },
                    {
                      id: 116,
                      name: 'size',
                      variant: 'declaration',
                      kind: 1024,
                      flags: { isOptional: true },
                      comment: {
                        summary: [{ kind: 'text', text: 'How large should the button be?' }]
                      },
                      type: {
                        type: 'union',
                        types: [
                          { type: 'literal', value: 'small' },
                          { type: 'literal', value: 'medium' },
                          { type: 'literal', value: 'large' }
                        ]
                      }
                    },
                    {
                      id: 117,
                      name: 'push',
                      variant: 'declaration',
                      kind: 2048,
                      signatures: [
                        {
                          id: 118,
                          name: 'push',
                          variant: 'signature',
                          kind: 4096,
                          type: { type: 'intrinsic', name: 'void' }
                        }
                      ]
                    }
                  ]
                }
              }
            },
            {
              id: 119,
              name: 'Element',
              variant: 'declaration',
              kind: 1024,
              type: { type: 'reference', name: 'HTMLButtonElement' }
            }
          ]
        }
      ]
    },

    // ── card module: TOC var + CardSignature with Blocks+Element+Style ──
    {
      id: 200,
      name: 'card',
      variant: 'declaration',
      kind: 2,
      children: [
        {
          id: 201,
          name: 'CardSignature',
          variant: 'declaration',
          kind: 256,
          sources: [{ fileName: 'demo/app/components/card.gts', line: 3 }],
          children: [
            {
              id: 202,
              name: 'Blocks',
              variant: 'declaration',
              kind: 1024,
              type: {
                type: 'reflection',
                declaration: {
                  id: 203,
                  name: '__type',
                  variant: 'declaration',
                  kind: 65_536,
                  children: [
                    {
                      id: 204,
                      name: 'body',
                      variant: 'declaration',
                      kind: 1024,
                      flags: { isOptional: true },
                      type: { type: 'tuple' }
                    },
                    {
                      id: 205,
                      name: 'default',
                      variant: 'declaration',
                      kind: 1024,
                      flags: { isOptional: true },
                      type: { type: 'tuple' }
                    },
                    {
                      id: 206,
                      name: 'footer',
                      variant: 'declaration',
                      kind: 1024,
                      flags: { isOptional: true },
                      type: { type: 'tuple' }
                    },
                    {
                      id: 207,
                      name: 'header',
                      variant: 'declaration',
                      kind: 1024,
                      flags: { isOptional: true },
                      type: { type: 'tuple' }
                    }
                  ]
                }
              }
            },
            {
              id: 208,
              name: 'Element',
              variant: 'declaration',
              kind: 1024,
              type: { type: 'reference', name: 'HTMLDivElement' }
            },
            {
              id: 209,
              name: 'Style',
              variant: 'declaration',
              kind: 1024,
              type: {
                type: 'reflection',
                declaration: {
                  id: 210,
                  name: '__type',
                  variant: 'declaration',
                  kind: 65_536,
                  children: [
                    {
                      id: 211,
                      name: 'CustomProperties',
                      variant: 'declaration',
                      kind: 1024,
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 212,
                          name: '__type',
                          variant: 'declaration',
                          kind: 65_536,
                          children: [
                            {
                              id: 213,
                              name: '--flow-space',
                              variant: 'declaration',
                              kind: 1024,
                              type: { type: 'literal', value: 'Spacing gap between flow elements' }
                            }
                          ]
                        }
                      }
                    },
                    {
                      id: 214,
                      name: 'Parts',
                      variant: 'declaration',
                      kind: 1024,
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 215,
                          name: '__type',
                          variant: 'declaration',
                          kind: 65_536,
                          children: [
                            {
                              id: 216,
                              name: 'body',
                              variant: 'declaration',
                              kind: 1024,
                              type: { type: 'literal', value: 'The main content area' }
                            },
                            {
                              id: 217,
                              name: 'footer',
                              variant: 'declaration',
                              kind: 1024,
                              type: { type: 'literal', value: 'Ancillary content' }
                            },
                            {
                              id: 218,
                              name: 'header',
                              variant: 'declaration',
                              kind: 1024,
                              type: { type: 'literal', value: 'For headlines' }
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
        },
        {
          id: 219,
          name: 'CardExport',
          variant: 'declaration',
          kind: 32,
          flags: { isConst: true },
          sources: [{ fileName: 'demo/app/components/card.gts', line: 22 }],
          type: {
            type: 'reference',
            target: {
              packageName: 'ember-source',
              packagePath: 'types/stable/@ember/component/template-only.d.ts',
              qualifiedName: '"@ember/component/template-only".TOC'
            },
            typeArguments: [
              { type: 'reference', target: 201, name: 'CardSignature', package: 'demo' }
            ],
            name: 'TOC',
            package: 'ember-source',
            qualifiedName: '"@ember/component/template-only".TOC'
          },
          defaultValue: '...'
        }
      ]
    },

    // ── greeting module: TOC var referencing GreetingSignature by qualifiedName ──
    //     GreetingSignature has Args (name: string)
    {
      id: 300,
      name: 'greeting',
      variant: 'declaration',
      kind: 2,
      children: [
        {
          id: 301,
          name: 'Greeting',
          variant: 'declaration',
          kind: 32,
          flags: { isConst: true },
          sources: [{ fileName: 'demo/app/components/greeting.gts', line: 9 }],
          type: {
            type: 'reference',
            target: {
              packageName: 'ember-source',
              packagePath: 'types/stable/@ember/component/template-only.d.ts',
              qualifiedName: '"@ember/component/template-only".TOC'
            },
            typeArguments: [
              {
                type: 'reference',
                target: {
                  packageName: 'demo',
                  packagePath: 'app/components/greeting.gts.ts',
                  qualifiedName: 'GreetingSignature'
                },
                name: 'GreetingSignature',
                package: 'demo'
              }
            ],
            name: 'TOC',
            package: 'ember-source',
            qualifiedName: '"@ember/component/template-only".TOC'
          },
          defaultValue: '...'
        },
        {
          id: 302,
          name: 'GreetingSignature',
          variant: 'declaration',
          kind: 256,
          sources: [{ fileName: 'demo/app/components/greeting.gts', line: 4 }],
          children: [
            {
              id: 303,
              name: 'Args',
              variant: 'declaration',
              kind: 1024,
              type: {
                type: 'reflection',
                declaration: {
                  id: 304,
                  name: '__type',
                  variant: 'declaration',
                  kind: 65_536,
                  children: [
                    {
                      id: 305,
                      name: 'name',
                      variant: 'declaration',
                      kind: 1024,
                      type: { type: 'intrinsic', name: 'string' },
                      comment: { summary: [{ kind: 'text', text: 'Name to greet' }] }
                    }
                  ]
                }
              }
            }
          ]
        }
      ]
    },

    // ── list module: generic V, List + Option classes, ListSignature with tuple+reflection ──
    {
      id: 400,
      name: 'list',
      variant: 'declaration',
      kind: 2,
      children: [
        {
          id: 401,
          name: 'ListSignature',
          variant: 'declaration',
          kind: 256,
          sources: [{ fileName: 'demo/app/components/list.gts', line: 40 }],
          children: [
            {
              id: 402,
              name: 'Args',
              variant: 'declaration',
              kind: 1024,
              type: {
                type: 'reflection',
                declaration: {
                  id: 403,
                  name: '__type',
                  variant: 'declaration',
                  kind: 65_536,
                  children: [
                    {
                      id: 404,
                      name: 'disabled',
                      variant: 'declaration',
                      kind: 1024,
                      flags: { isOptional: true },
                      type: { type: 'intrinsic', name: 'boolean' }
                    },
                    {
                      id: 430,
                      name: 'activateItem',
                      variant: 'declaration',
                      kind: 1024,
                      flags: { isOptional: true },
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 431,
                          name: '__type',
                          variant: 'declaration',
                          kind: 65_536,
                          signatures: [
                            {
                              id: 432,
                              name: '__type',
                              variant: 'signature',
                              kind: 4096,
                              parameters: [
                                {
                                  id: 433,
                                  name: 'value',
                                  variant: 'param',
                                  kind: 32_768,
                                  type: {
                                    type: 'reference',
                                    target: 411,
                                    name: 'V',
                                    package: 'demo',
                                    refersToTypeParameter: true
                                  }
                                }
                              ],
                              type: { type: 'intrinsic', name: 'void' }
                            }
                          ]
                        }
                      }
                    },
                    {
                      id: 434,
                      name: 'update',
                      variant: 'declaration',
                      kind: 1024,
                      flags: { isOptional: true },
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 435,
                          name: '__type',
                          variant: 'declaration',
                          kind: 65_536,
                          signatures: [
                            {
                              id: 436,
                              name: '__type',
                              variant: 'signature',
                              kind: 4096,
                              parameters: [
                                {
                                  id: 437,
                                  name: 'value',
                                  variant: 'param',
                                  kind: 32_768,
                                  type: {
                                    type: 'union',
                                    types: [
                                      {
                                        type: 'reference',
                                        target: 411,
                                        name: 'V',
                                        package: 'demo',
                                        refersToTypeParameter: true
                                      },
                                      {
                                        type: 'array',
                                        elementType: {
                                          type: 'reference',
                                          target: 411,
                                          name: 'V',
                                          package: 'demo',
                                          refersToTypeParameter: true
                                        }
                                      }
                                    ]
                                  }
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
              id: 405,
              name: 'Blocks',
              variant: 'declaration',
              kind: 1024,
              type: {
                type: 'reflection',
                declaration: {
                  id: 406,
                  name: '__type',
                  variant: 'declaration',
                  kind: 65_536,
                  children: [
                    {
                      id: 407,
                      name: 'default',
                      variant: 'declaration',
                      kind: 1024,
                      type: {
                        type: 'tuple',
                        elements: [
                          {
                            type: 'reflection',
                            declaration: {
                              id: 408,
                              name: '__type',
                              variant: 'declaration',
                              kind: 65_536,
                              children: [
                                {
                                  id: 409,
                                  name: 'Option',
                                  variant: 'declaration',
                                  kind: 1024,
                                  type: {
                                    type: 'reference',
                                    target: {
                                      packageName: '@glint/template',
                                      packagePath: '-private/integration.d.ts',
                                      qualifiedName: 'Invokable'
                                    },
                                    name: 'Invokable',
                                    package: '@glint/template'
                                  },
                                  comment: { summary: [{ kind: 'text', text: 'A sub-component' }] }
                                }
                              ]
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            },
            {
              id: 410,
              name: 'Element',
              variant: 'declaration',
              kind: 1024,
              type: { type: 'reference', name: 'HTMLDivElement' }
            }
          ],
          typeParameters: [{ id: 411, name: 'V', variant: 'typeParam', kind: 131_072 }]
        },
        {
          id: 412,
          name: 'OptionSignature',
          variant: 'declaration',
          kind: 256,
          sources: [{ fileName: 'demo/app/components/list.gts', line: 9 }],
          children: [
            {
              id: 413,
              name: 'Args',
              variant: 'declaration',
              kind: 1024,
              type: {
                type: 'reflection',
                declaration: {
                  id: 414,
                  name: '__type',
                  variant: 'declaration',
                  kind: 65_536,
                  children: [
                    {
                      id: 415,
                      name: 'value',
                      variant: 'declaration',
                      kind: 1024,
                      type: { type: 'intrinsic', name: 'string' }
                    }
                  ]
                }
              }
            },
            {
              id: 416,
              name: 'Element',
              variant: 'declaration',
              kind: 1024,
              type: { type: 'reference', name: 'HTMLOptionElement' }
            }
          ],
          typeParameters: [{ id: 417, name: 'V', variant: 'typeParam', kind: 131_072 }]
        },
        {
          id: 418,
          name: 'List',
          variant: 'declaration',
          kind: 128,
          extendedTypes: [
            {
              type: 'reference',
              target: {
                packageName: '@glimmer/component',
                packagePath: 'dist/index.d.ts',
                qualifiedName: 'default'
              },
              typeArguments: [
                {
                  type: 'reference',
                  target: 401,
                  typeArguments: [{ type: 'reference', target: 419, refersToTypeParameter: true }],
                  name: 'ListSignature',
                  package: 'demo'
                }
              ],
              name: 'default',
              package: '@glimmer/component'
            }
          ],
          sources: [{ fileName: 'demo/app/components/list.gts', line: 40 }],
          typeParameters: [{ id: 419, name: 'V', variant: 'typeParam', kind: 131_072 }]
        },
        {
          id: 420,
          name: 'Option',
          variant: 'declaration',
          kind: 128,
          extendedTypes: [
            {
              type: 'reference',
              target: {
                packageName: '@glimmer/component',
                packagePath: 'dist/index.d.ts',
                qualifiedName: 'default'
              },
              typeArguments: [
                {
                  type: 'reference',
                  target: 412,
                  typeArguments: [{ type: 'reference', target: 421, refersToTypeParameter: true }],
                  name: 'OptionSignature',
                  package: 'demo'
                }
              ],
              name: 'default',
              package: '@glimmer/component'
            }
          ],
          sources: [{ fileName: 'demo/app/components/list.gts', line: 10 }],
          typeParameters: [{ id: 421, name: 'V', variant: 'typeParam', kind: 131_072 }]
        }
      ]
    },

    // ── header module: Signature with only Args (no Blocks/Element/Style) ──
    {
      id: 500,
      name: 'header',
      variant: 'declaration',
      kind: 2,
      children: [
        {
          id: 501,
          name: 'Signature',
          variant: 'declaration',
          kind: 256,
          sources: [{ fileName: 'demo/app/components/header.gts', line: 6 }],
          children: [
            {
              id: 502,
              name: 'Args',
              variant: 'declaration',
              kind: 1024,
              type: {
                type: 'reflection',
                declaration: {
                  id: 503,
                  name: '__type',
                  variant: 'declaration',
                  kind: 65_536,
                  children: [
                    {
                      id: 504,
                      name: 'createAccount',
                      variant: 'declaration',
                      kind: 1024,
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 505,
                          name: '__type',
                          variant: 'declaration',
                          kind: 65_536,
                          signatures: [
                            {
                              id: 506,
                              name: '__type',
                              variant: 'signature',
                              kind: 4096,
                              type: { type: 'intrinsic', name: 'void' }
                            }
                          ]
                        }
                      }
                    },
                    {
                      id: 507,
                      name: 'login',
                      variant: 'declaration',
                      kind: 1024,
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 508,
                          name: '__type',
                          variant: 'declaration',
                          kind: 65_536,
                          signatures: [
                            {
                              id: 509,
                              name: '__type',
                              variant: 'signature',
                              kind: 4096,
                              type: { type: 'intrinsic', name: 'void' }
                            }
                          ]
                        }
                      }
                    },
                    {
                      id: 510,
                      name: 'logout',
                      variant: 'declaration',
                      kind: 1024,
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 511,
                          name: '__type',
                          variant: 'declaration',
                          kind: 65_536,
                          signatures: [
                            {
                              id: 512,
                              name: '__type',
                              variant: 'signature',
                              kind: 4096,
                              type: { type: 'intrinsic', name: 'void' }
                            }
                          ]
                        }
                      }
                    },
                    {
                      id: 513,
                      name: 'user',
                      variant: 'declaration',
                      kind: 1024,
                      flags: { isOptional: true },
                      type: {
                        type: 'reflection',
                        declaration: {
                          id: 514,
                          name: '__type',
                          variant: 'declaration',
                          kind: 65_536,
                          children: [
                            {
                              id: 515,
                              name: 'name',
                              variant: 'declaration',
                              kind: 1024,
                              type: { type: 'intrinsic', name: 'string' }
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
        },
        {
          id: 516,
          name: 'Header',
          variant: 'declaration',
          kind: 32,
          flags: { isConst: true },
          sources: [{ fileName: 'demo/app/components/header.gts', line: 31 }],
          type: {
            type: 'reference',
            target: {
              packageName: 'ember-source',
              packagePath: 'types/stable/@ember/component/template-only.d.ts',
              qualifiedName: '"@ember/component/template-only".TemplateOnlyComponent'
            },
            typeArguments: [{ type: 'intrinsic', name: 'unknown' }],
            name: 'TemplateOnlyComponent',
            package: 'ember-source',
            qualifiedName: '"@ember/component/template-only".TemplateOnlyComponent'
          },
          defaultValue: '...'
        }
      ]
    },

    // ── Non-signature interface ──
    {
      id: 600,
      name: 'NotASignature',
      variant: 'declaration',
      kind: 256,
      children: [
        {
          id: 601,
          name: 'foo',
          variant: 'declaration',
          kind: 1024,
          type: { type: 'intrinsic', name: 'string' }
        }
      ]
    },

    // ── Class without Component extends ──
    {
      id: 700,
      name: 'SomePlainClass',
      variant: 'declaration',
      kind: 128,
      sources: [{ fileName: 'demo/app/misc.gts', line: 1 }]
    },

    // ── Reference reflection pointing to button's default class ──
    {
      id: 800,
      name: 'default',
      variant: 'reference',
      kind: 128,
      target: 101,
      sources: [{ fileName: 'demo/app/components/button.gts', line: 1 }]
    }
  ]
};

// ── Tests ─────────────────────────────────────────────────────────

describe('analyze', () => {
  test('extracts Args from class extending Component<Signature>', () => {
    const result = analyze(FIXTURE as never);
    const sig = result['demo/app/components/button.gts'][Default];

    expect(sig.args).toHaveProperty('backgroundColor');
    expect(sig.args).toHaveProperty('label');
    expect(sig.args).toHaveProperty('primary');
    expect(sig.args).toHaveProperty('size');

    expect(sig.args.backgroundColor).toEqual({
      type: { category: 'string', raw: 'string' },
      required: false,
      description: 'What background color to use',
      defaultValue: undefined
    });
    expect(sig.args.label).toEqual({
      type: { category: 'string', raw: 'string' },
      required: true,
      description: 'Button contents',
      defaultValue: undefined
    });
    expect(sig.args.primary).toEqual({
      type: { category: 'boolean', raw: 'boolean' },
      required: false,
      description: 'Is this the principal call to action on the page?',
      defaultValue: undefined
    });
    expect(sig.args.size).toEqual({
      type: {
        category: 'enum',
        raw: 'small | medium | large',
        options: ['small', 'medium', 'large']
      },
      required: false,
      description: 'How large should the button be?',
      defaultValue: undefined
    });
  });

  test('extracts Blocks from CardSignature', () => {
    const result = analyze(FIXTURE as never);
    const sig = result['demo/app/components/card.gts'].CardExport;

    expect(sig.blocks).toHaveProperty('body');
    expect(sig.blocks).toHaveProperty('default');
    expect(sig.blocks).toHaveProperty('footer');
    expect(sig.blocks).toHaveProperty('header');
    expect(sig.blocks.body.params).toEqual([]);
    expect(sig.blocks.default.params).toEqual([]);
    expect(sig.blocks.footer.params).toEqual([]);
    expect(sig.blocks.header.params).toEqual([]);
  });

  test('extracts Style from CardSignature', () => {
    const result = analyze(FIXTURE as never);
    const sig = result['demo/app/components/card.gts'].CardExport;

    expect(sig.style.customProperties).toEqual({
      '--flow-space': 'Spacing gap between flow elements'
    });
    expect(sig.style.parts).toEqual({
      body: 'The main content area',
      footer: 'Ancillary content',
      header: 'For headlines'
    });
  });

  test('extracts Element from component signatures', () => {
    const result = analyze(FIXTURE as never);
    const buttonSig = result['demo/app/components/button.gts'][Default];
    const cardSig = result['demo/app/components/card.gts'].CardExport;

    expect(buttonSig.element).toBe('HTMLButtonElement');
    expect(cardSig.element).toBe('HTMLDivElement');
  });

  test('associates signature via TOC<Signature> variable with internal ID reference', () => {
    const result = analyze(FIXTURE as never);
    const sig = result['demo/app/components/card.gts'].CardExport;

    expect(sig).toBeDefined();
    expect(sig.blocks).toHaveProperty('header');
  });

  test('associates signature via TOC<Signature> variable with external qualifiedName reference', () => {
    const result = analyze(FIXTURE as never);
    const sig = result['demo/app/components/greeting.gts'].Greeting;

    expect(sig).toBeDefined();
    expect(sig.args).toBeDefined();
  });

  test('handles interfaces named just "Signature" (not XxxSignature)', () => {
    const result = analyze(FIXTURE as never);
    const sig = result['demo/app/components/button.gts'][Default];

    expect(sig).toBeDefined();
  });

  test('uses Default key when reflection name is "default"', () => {
    const result = analyze(FIXTURE as never);
    const sig = result['demo/app/components/button.gts'][Default];

    expect(sig).toBeDefined();
    expect(sig.args.label.type).toEqual({ category: 'string', raw: 'string' });
  });

  test('skips reference reflections (variant=reference)', () => {
    const result = analyze(FIXTURE as never);

    // The "default" entry in the result comes from the actual class (id:101),
    // not from the reference reflection (id:800). Verify no duplicate overwrites.
    expect(Object.keys(result['demo/app/components/button.gts'])).toEqual([Default]);
  });

  test('returns empty map when no signatures found', () => {
    const result = analyze({
      id: 1,
      variant: 'project',
      name: 'empty',
      kind: 1,
      children: []
    } as never);

    expect(result).toEqual({});
  });

  test('skips interfaces without Args/Blocks/Element/Style', () => {
    const result = analyze(FIXTURE as never);

    expect(result).not.toHaveProperty('demo/app/components/NotASignature');
  });

  test('isEmberComponent identifies class extending Component', () => {
    const result = analyze(FIXTURE as never);

    expect(result['demo/app/components/button.gts'][Default]).toBeDefined();
    expect(result['demo/app/components/list.gts'].List).toBeDefined();
    expect(result['demo/app/components/list.gts'].Option).toBeDefined();
  });

  test('isEmberComponent rejects class without Component extends', () => {
    const result = analyze(FIXTURE as never);

    expect(result).not.toHaveProperty('demo/app/misc.gts');
  });

  test('extracts block params from tuple containing reflection (yield hash)', () => {
    const result = analyze(FIXTURE as never);
    const sig = result['demo/app/components/list.gts'].List;
    const block = sig.blocks.default;

    expect(block.params).toHaveLength(1);
    expect(block.params[0]).toEqual({
      Option: {
        name: 'Option',
        type: 'Invokable',
        componentRef: {
          filePath: 'demo/app/components/list.gts',
          exportName: 'Option',
          modifiers: undefined
        },
        description: 'A sub-component'
      }
    });
  });

  test('extracts defaultValue stripping markdown code fences', () => {
    const fixture = structuredClone(FIXTURE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buttonModule = (fixture as any).children.find((c: any) => c.id === 100);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signatureIface = buttonModule?.children?.find((c: any) => c.id === 110);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const argsProp = signatureIface?.children?.find((c: any) => c.name === 'Args');

    const argsReflection = argsProp?.type?.declaration;

    // Overwrite label to have @default with code fence, add a @defaultValue too
    for (const child of argsReflection.children) {
      if (child.name === 'label') {
        child.comment = {
          summary: [{ kind: 'text', text: 'Button contents' }],
          blockTags: [{ tag: '@default', content: [{ kind: 'code', text: '```ts\nfalse\n```' }] }]
        };
      }

      if (child.name === 'size') {
        child.comment = {
          summary: [{ kind: 'text', text: 'How large' }],
          blockTags: [
            { tag: '@defaultValue', content: [{ kind: 'code', text: '```ts\n"lg"\n```' }] }
          ]
        };
      }

      if (child.name === 'primary') {
        child.comment = {
          summary: [{ kind: 'text', text: 'Is primary' }],
          blockTags: [{ tag: '@default', content: [{ kind: 'text', text: '42' }] }]
        };
      }
    }

    const result = analyze(fixture as never);
    const args = result['demo/app/components/button.gts'][Default].args;

    expect(args.label.defaultValue).toBe('false');
    expect(args.size.defaultValue).toBe('"lg"');
    expect(args.primary.defaultValue).toBe('42');
  });

  test('creates marker ref for block param referencing same-file component', () => {
    const result = analyze(FIXTURE as never);
    const blockParam = result['demo/app/components/list.gts'].List.blocks.default.params[0];

    // Option is recognized as a component in the same file
    expect(result['demo/app/components/list.gts'].Option).toBeDefined();

    // Block param has marker ref: exportName is set, filePath points at the
    // same file (TypeDoc-relative); typedoc.ts rewrites it to the fs path.
    expect((blockParam as HashBlockParam).Option.componentRef).toBeDefined();
    expect((blockParam as HashBlockParam).Option.componentRef?.filePath).toBe(
      'demo/app/components/list.gts'
    );
    expect((blockParam as HashBlockParam).Option.componentRef?.exportName).toBe('Option');
    expect((blockParam as HashBlockParam).Option.componentRef?.importPath).toBeUndefined();
  });

  test('resolves componentRef exportName to Default for default-export subcomponents', () => {
    // Build a parent (card) + child (separate file default-export component).
    // Cross-file references resolve via isEmberComponent file-based fallback
    // because the child's signature is already in `parsed` by the time the
    // parent's blocks are processed.
    const fixture = structuredClone(FIXTURE);

    // Add a child module with a default-export component.
    // Must be inserted BEFORE card module so its signature is in
    // `parsed` when the card's blocks are processed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fixture as any).children.unshift({
      id: 900,
      name: 'child',
      variant: 'declaration',
      kind: 2,
      children: [
        {
          id: 910,
          name: 'default',
          variant: 'declaration',
          kind: 128,
          extendedTypes: [
            {
              type: 'reference',
              target: {
                packageName: '@glimmer/component',
                packagePath: 'dist/index.d.ts',
                qualifiedName: 'default'
              },
              typeArguments: [
                { type: 'reference', target: 911, name: 'ChildSignature', package: 'demo' }
              ],
              name: 'default',
              package: '@glimmer/component'
            }
          ],
          sources: [{ fileName: 'demo/app/components/child.gts', line: 5 }]
        },
        {
          id: 911,
          name: 'ChildSignature',
          variant: 'declaration',
          kind: 256,
          sources: [{ fileName: 'demo/app/components/child.gts', line: 3 }],
          children: [
            {
              id: 920,
              name: 'Args',
              variant: 'declaration',
              kind: 1024,
              type: {
                type: 'reflection',
                declaration: {
                  id: 921,
                  name: '__type',
                  variant: 'declaration',
                  kind: 65_536,
                  children: []
                }
              }
            }
          ]
        }
      ]
    });

    // Override card's body block to reference the child component
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cardModule = (fixture as any).children.find((c: any) => c.id === 200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cardSig = cardModule.children.find((c: any) => c.id === 201);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocksProp = cardSig.children.find((c: any) => c.name === 'Blocks');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bodyBlock = blocksProp.type.declaration.children.find((c: any) => c.name === 'body');

    bodyBlock.type = {
      type: 'tuple',
      elements: [
        {
          type: 'reflection',
          declaration: {
            id: 912,
            name: '__type',
            variant: 'declaration',
            kind: 65_536,
            children: [
              {
                id: 913,
                name: 'component',
                variant: 'declaration',
                kind: 1024,
                type: { type: 'reference', name: 'ChildComp', target: 910 }
              }
            ]
          }
        }
      ]
    };

    const result = analyze(fixture as never);
    const parent = result['demo/app/components/card.gts'].CardExport;
    const blockParam = (parent.blocks.body.params[0] as HashBlockParam).component;

    expect(blockParam.componentRef).toBeDefined();
    expect((blockParam.componentRef as { exportName: string }).exportName).toBe(Default);
    expect((blockParam.componentRef as { filePath: string }).filePath).toBe(
      'demo/app/components/child.gts'
    );
  });

  test('extracts Args-only signature (no Blocks/Element/Style)', () => {
    const result = analyze(FIXTURE as never);
    const sig = result['demo/app/components/header.gts'].Header;

    expect(sig.args).toHaveProperty('createAccount');
    expect(sig.args).toHaveProperty('login');
    expect(sig.args).toHaveProperty('logout');
    expect(sig.args).toHaveProperty('user');
    expect(sig.args.user.required).toBe(false);

    expect(sig.element).toBeUndefined();
    expect(sig.blocks).toEqual({});
    expect(sig.style).toEqual({ customProperties: {}, parts: {} });
  });

  test('extracts raw type for function args', () => {
    const result = analyze(FIXTURE as never);
    const sig = result['demo/app/components/list.gts'].List;

    expect(sig.args.activateItem.type.raw).toBe('(value: V) => void');
    expect(sig.args.update.type.raw).toBe('(value: V | V[]) => void');
  });
});
