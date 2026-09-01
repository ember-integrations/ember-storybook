import type { BlockInfo, BlockParam, HashBlockParam } from './signature';

function isBlockParam(param: BlockParam | HashBlockParam): param is BlockParam {
  return Object.hasOwn(param, 'name') && Object.hasOwn(param, 'type');
}

/**
 * Unwrap the params union to plain block params at the yield surface: a
 * yield hash expands to its named entries, but unfolded named types
 * (`nested`) are not descended into. Use for anything reflecting what the
 * block actually receives (e.g. slot bindings).
 */
export function unwrapBlockParamsShallow(params: BlockInfo['params']): BlockParam[] {
  return params.flatMap((param) => (isBlockParam(param) ? [param] : Object.values(param)));
}

/**
 * Unwrap every block param: yield hashes expand to their named entries and
 * unfolded named types descend into all members — the whole param tree. Use
 * wherever every referenced component must be found (transitive file
 * queueing, subcomponent collection, ref rewriting).
 */
export function unwrapBlockParams(params: BlockInfo['params']): BlockParam[] {
  const result: BlockParam[] = [];

  for (const param of params) {
    if (isBlockParam(param)) {
      result.push(param);

      const nested = param.nested;

      if (nested && nested.length > 0) {
        result.push(...unwrapBlockParams(nested));
      }
    } else {
      result.push(...unwrapBlockParams(Object.values(param)));
    }
  }

  return result;
}
