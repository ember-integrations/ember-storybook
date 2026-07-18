import {
  ArgTypes,
  Controls,
  Description,
  Primary,
  Stories,
  Subheading,
  Subtitle,
  Title,
  useOf
} from '@storybook/addon-docs/blocks';
import { createElement, Fragment, type ReactNode } from 'react';
import emberData from 'virtual:ember-storybook';

import {
  BlocksTable,
  CssPropertiesTable,
  ElementBlock,
  PartsTable,
  StoriesHeading,
  SubcomponentsArea
} from './blocks';

import type { BlockParam, ComponentSignature } from '../../node/typedoc/types';
import type { SubcomponentRef } from './blocks';

function collectSubcomponents(
  blocks: Record<string, { params: BlockParam[] }>,
  data: Record<
    string,
    {
      meta?: unknown;
      source?: Record<string, string | undefined>;
      signatures?: Record<string, ComponentSignature>;
    }
  >
): SubcomponentRef[] {
  const refMap = new Map<string, SubcomponentRef>();
  let badge = 0;

  const storyInternalNames = new Set<string>();

  for (const entry of Object.values(data)) {
    const meta = entry.meta as Record<string, string | undefined | symbol> | undefined;

    if (meta && 'componentName' in meta && 'source' in entry) {
      const storyMeta = meta as { componentName: string; exportedName: string };

      storyInternalNames.add(storyMeta.componentName);
    }
  }

  for (const block of Object.values(blocks)) {
    for (const param of block.params) {
      if (!param.componentRef) continue;

      const { filePath, exportName } = param.componentRef;
      const key = `${filePath}:${exportName}`;

      if (refMap.has(key)) continue;

      const entry = data[filePath];
      const sig = entry?.signatures?.[exportName];

      if (!sig) continue;

      badge++;

      refMap.set(key, {
        badge,
        key,
        name: exportName,
        signature: sig,
        hasStory: storyInternalNames.has(exportName)
      });
    }
  }

  return refMap.values().toArray();
}

function addSignature(signature: ComponentSignature) {
  const children: ReactNode[] = [];

  if (signature.element) {
    children.push(createElement(ElementBlock, { element: signature.element }));
  }

  if (Object.keys(signature.args).length > 0) {
    children.push(
      createElement(Subheading, undefined, 'Args'),
      createElement(ArgTypes, { include: Object.keys(signature.args) }),
      createElement(Controls, { include: Object.keys(signature.args) })
    );
  }

  if (Object.keys(signature.blocks).length > 0) {
    const subcomponents = collectSubcomponents(signature.blocks, emberData);

    children.push(
      createElement(BlocksTable, { blocks: signature.blocks, subcomponentRefs: subcomponents })
    );

    if (subcomponents.length > 0) {
      children.push(createElement(SubcomponentsArea, { components: subcomponents }));
    }
  }

  if (Object.keys(signature.style.customProperties).length > 0) {
    const entries = Object.entries(signature.style.customProperties).map(([name, description]) => ({
      name,
      description
    }));

    children.push(
      createElement(Subheading, undefined, 'CSS Custom Properties'),
      createElement(CssPropertiesTable, { entries })
    );
  }

  if (Object.keys(signature.style.parts).length > 0) {
    const entries = Object.entries(signature.style.parts).map(([name, description]) => ({
      name,
      description
    }));

    children.push(
      createElement(Subheading, undefined, 'Parts'),
      createElement(PartsTable, { entries })
    );
  }

  if (children.length > 0) {
    children.unshift(createElement(StoriesHeading, undefined, 'Signature'));
  }

  return children;
}

export default function Page() {
  const resolved: {
    preparedMeta?: {
      argTypes?: Record<string, unknown>;
      title?: string;
      parameters?: Record<string, unknown>;
    };
  } = useOf('meta', ['meta']);

  const data = emberData as Record<
    string,
    {
      meta?: unknown;
      component?: { file?: string; signatureName?: string };
      source?: Record<string, string | undefined>;
      signatures?: Record<string, ComponentSignature>;
    }
  >;
  const storyFile = resolved.preparedMeta?.parameters?.fileName as string | undefined;
  const storyEntry = storyFile ? data[storyFile] : undefined;
  const storyComponent = storyEntry?.component;
  const compFile = storyComponent?.file;
  const compEntry = compFile ? data[compFile] : undefined;
  const signature = compEntry?.signatures?.[storyComponent?.signatureName ?? ''];

  console.log({ emberData, resolved, storyFile, storyEntry, compFile, compEntry });

  const children: ReactNode[] = [
    createElement(Title),
    createElement(Subtitle),
    createElement(Description),
    createElement(Primary)
  ];

  if (signature) {
    children.push(...addSignature(signature));
  }

  children.push(createElement(Stories));

  return createElement(Fragment, undefined, ...children);
}
