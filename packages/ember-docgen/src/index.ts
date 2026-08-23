export {
  analyzeTypedoc,
  parseTypedocFile,
  parseTypedocProject
} from './typedoc/index';

export { analyzeDeclarations, parseDeclarations } from './declarations';

export { parseSignatures } from './typescript';

export { Default } from './signature';

export type {
  ArgInfo,
  ArgTypeCategory,
  ArgTypeInfo,
  BlockInfo,
  BlockParam,
  ComponentSignature,
  ComponentSignatureMap,
  DocgenOptions,
  HashBlockParam
} from './signature';
