import { ArgTypes, Subheading } from '@storybook/addon-docs/blocks';
import { createElement, type ReactNode } from 'react';
import { styled } from 'storybook/theming';

import { BlocksTable, ParamRow, ParamType } from './blocks';
import { ElementBlock } from './element';
import { H2 } from './ui';

import type { EmberMeta } from '../../../node/types';
import type { SubcomponentRef } from '../signature';
import type { ComponentSignature } from 'ember-docgen';

const SubcomponentsSection = styled.div(() => ({
  marginTop: 25,
  marginBottom: 40
}));

const SubEntry = styled.div(() => ({
  marginBottom: 24,
  '&:last-child': { marginBottom: 0 }
}));

const SectionLabel = styled.div(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.color.defaultText,
  fontSize: theme.typography.size.m1 - 2,
  marginBottom: 8
}));

function renderSubcomponentSignature(
  sig: ComponentSignature,
  subcomponentNames: Set<string>,
  defaultName: string,
  data?: EmberMeta
): ReactNode[] {
  const children: ReactNode[] = [];

  if (sig.element) {
    children.push(createElement(ElementBlock, { element: sig.element }));
  }

  if (Object.keys(sig.args).length > 0) {
    children.push(
      createElement(SectionLabel, undefined, 'Args'),
      createElement(ArgTypes, { include: Object.keys(sig.args) })
    );
  }

  if (Object.keys(sig.blocks).length > 0) {
    children.push(
      createElement(SectionLabel, { key: 'blocks-label', style: { marginTop: 12 } }, 'Blocks'),
      createElement(BlocksTable, { blocks: sig.blocks, subcomponentNames, defaultName, data })
    );
  }

  return children;
}

export function SubcomponentsArea({
  components,
  data
}: {
  components: SubcomponentRef[];
  data?: EmberMeta;
}) {
  if (components.length === 0) return;

  const subcomponentNames = new Set(components.map((c) => c.name));

  const entries = components.map((comp) => {
    const children: ReactNode[] = [createElement(Subheading, undefined, comp.name)];

    if (comp.importPath) {
      children.push(
        createElement(
          ParamRow,
          { key: 'import', style: { marginBottom: 12 } },
          createElement('span', undefined, "from '"),
          createElement(ParamType, undefined, comp.importPath),
          createElement('span', undefined, "'")
        )
      );
    } else if (comp.signature) {
      children.push(
        ...renderSubcomponentSignature(comp.signature, subcomponentNames, comp.name, data)
      );
    }

    return createElement(
      SubEntry,
      { id: `subcomponent-${comp.name}`, key: comp.name },
      ...children
    );
  });

  return createElement(
    SubcomponentsSection,
    undefined,
    createElement(H2, undefined, 'Subcomponents'),
    ...entries
  );
}
