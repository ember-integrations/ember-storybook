import type { TypeDocOptions as TypeDocConfig } from 'typedoc';

export type ArgTypeCategory =
  | 'string'
  | 'number'
  | 'boolean'
  | 'function'
  | 'object'
  | 'array'
  | 'enum'
  | 'union'
  | 'symbol'
  | 'other';

export interface ArgTypeInfo {
  /** The semantic type category */
  category: ArgTypeCategory;
  /** Full type string for display (e.g. "string", "(value: string) => void", "'small' | 'medium' | 'large'") */
  raw: string;
  /** For 'enum': the literal option values */
  options?: string[];
  /** For 'array': the element type */
  elementType?: ArgTypeInfo;
  /** For 'object': known property names mapped to their types */
  properties?: Record<string, ArgTypeInfo>;
}

export interface ArgInfo {
  type: ArgTypeInfo;
  required: boolean;
  description: string;
  defaultValue?: string;
}

export interface ComponentSignature {
  args: Record<string, ArgInfo>;
  blocks: Record<string, BlockInfo>;
  element: string | undefined;
  style: {
    customProperties: Record<string, string>;
    parts: Record<string, string>;
  };
}

export interface BlockParam {
  name: string;
  type: string;
  description?: string;
  componentRef?:
    | undefined
    | {
        filePath: string;
        exportName: string;
        importPath?: string;
        /** The referenced component is local to the block's own file — name it by the yield key. */
        local?: boolean;
        modifiers?: { name: string; typeArgs: string[] }[];
      };
}

/** A yield hash block param, keyed by the hash key (e.g. `{ Option: ... }`) */
export type HashBlockParam = Record<string, BlockParam>;

export interface BlockInfo {
  params: (BlockParam | HashBlockParam)[];
  description?: string;
}

export type ComponentSignatureMap = Record<string, Record<string, ComponentSignature>>;

/** Key used for default-export components */
export const Default = '__DEFAULT__';

/**
 * Shared options for parseFile/parseProject/analyze.
 *
 * Precedence for typedoc settings:
 * inline `typedocConfig` > `typedocConfigFile` > TypeDoc default discovery.
 * `tsconfigFile` acts as the path anchor: parse pins TypeDoc's displayBasePath
 * to the tsconfig directory so JSON sources are relative to a base that
 * analyze() can re-derive from the same opts.
 */
export interface DocgenOptions {
  /** Path to tsconfig.json. If omitted, discovered walking up from cwd. */
  tsconfigFile?: string;
  /** Path to typedoc.json / typedoc.config.js. If omitted, TypeDoc discovers it. */
  typedocConfigFile?: string;
  /** Inline typedoc options, merged on top of typedocConfigFile / defaults. */
  typedocConfig?: Partial<TypeDocConfig>;
}
