import type { BlockInfo, BlockParam, HashBlockParam } from 'ember-docgen';

function isBlockParam(param: BlockParam | HashBlockParam): param is BlockParam {
  return Object.hasOwn(param, 'name') && Object.hasOwn(param, 'type');
}

/** Flatten the params union into plain block params, unwrapping yield hashes. */
export function unwrapBlockParams(params: BlockInfo['params']): BlockParam[] {
  return params.flatMap((param) => (isBlockParam(param) ? [param] : Object.values(param)));
}
