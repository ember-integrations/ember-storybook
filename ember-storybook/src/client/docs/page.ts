import {
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

import { BlocksSection } from './blocks/blocks';
import { ElementBlock } from './blocks/element';
import { CssPropertiesTable, PartsTable } from './blocks/style';
import { SubcomponentsArea } from './blocks/subcomponents';
import { H2 } from './blocks/ui';
import { collectSubcomponents } from './signature';

import type { EmberMeta } from '../../node/types';
import type { ComponentSignature } from 'ember-docgen';

function addSignature(signature: ComponentSignature, data: EmberMeta) {
  const children: ReactNode[] = [];

  if (signature.element) {
    children.push(createElement(ElementBlock, { element: signature.element }));
  }

  if (Object.keys(signature.args).length > 0) {
    children.push(
      createElement(Subheading, undefined, 'Args'),
      // createElement(ArgTypes, { include: Object.keys(signature.args) }),
      createElement(Controls, { include: Object.keys(signature.args) })
    );
  }

  if (Object.keys(signature.blocks).length > 0) {
    const subcomponents = collectSubcomponents(signature.blocks, data);
    const subcomponentNames = new Set(subcomponents.map((s) => s.name));

    children.push(createElement(BlocksSection, { blocks: signature.blocks, subcomponentNames }));

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
    children.unshift(createElement(H2, undefined, 'Signature'));
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

  // console.log({ emberData, resolved, storyFile, storyEntry, compFile, compEntry, signature });

  const children: ReactNode[] = [
    createElement(Title),
    createElement(Subtitle),
    createElement(Description),
    createElement(Primary)
  ];

  if (signature) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    children.push(...addSignature(signature, emberData));
  }

  children.push(createElement(Stories));

  return createElement(Fragment, undefined, ...children);
}
