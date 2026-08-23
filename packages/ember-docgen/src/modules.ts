/**
 * Import origins of the types that identify Ember component constructs.
 *
 * All three extraction strategies (typescript, declarations, typedoc) must
 * verify wrapper identity against these origins instead of matching bare
 * identifiers — otherwise any local type named `TOC` matches, and renamed
 * imports (`import type { TOC as TemplateOnlyComponent }`) are missed.
 *
 * This file is internal and the single place to adapt when the ecosystem
 * moves these types.
 */

/** Module emitting template-only component wrappers. */
export const TEMPLATE_ONLY_MODULE = '@ember/component/template-only';

/** Module emitting the classic component base class. */
export const COMPONENT_MODULE = '@glimmer/component';

/** Module emitting Glint's component integration utilities. */
export const GLINT_TEMPLATE_MODULE = '@glint/template';

/**
 * Canonical export names accepted from {@link TEMPLATE_ONLY_MODULE}.
 * `ComponentLike`/`Invokable` live in `@glint/template`.
 */
export const SIGNATURE_WRAPPER_EXPORTS: readonly string[] = ['TOC', 'TemplateOnlyComponent'];

/** Canonical export names accepted from {@link GLINT_TEMPLATE_MODULE}. */
export const GLINT_WRAPPER_EXPORTS: readonly string[] = [
  'ComponentLike',
  'Invokable',
  'WithBoundArgs'
];

/** Canonical export name accepted from {@link COMPONENT_MODULE}. */
export const COMPONENT_BASE_NAME = 'Component';
