import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { componentSource, resolveTemplateArgs } from '../client/docs/source-code';
import { resolveTsconfigBase, runTypeDoc } from './docgen/docgen';
import { parseStoryFile, type StoryFile } from './parser';
import { Default } from './shared';

import type { BlockInfo, BlockParam, ComponentSignature } from 'ember-docgen';
import type { ComponentManifest, ComponentsManifest, IndexEntry } from 'storybook/internal/types';

function cell(text: string): string {
  return text.replaceAll('|', String.raw`\|`).replaceAll(/\s*\n\s*/g, ' ');
}

function isBlockParam(param: BlockParam | Record<string, BlockParam>): param is BlockParam {
  return Object.hasOwn(param, 'name') && Object.hasOwn(param, 'type');
}

// A yielded component's type is Glint's expanded `Invokable<...>`; name the component instead.
function paramType(param: BlockParam): string {
  return param.componentRef ? 'component' : `\`${cell(param.type)}\``;
}

function describeParam(param: BlockParam): string {
  const description = param.description ? `: ${cell(param.description)}` : '';

  return `\`${param.name}\` (${paramType(param)})${description}`;
}

function describeBlock(name: string, block: BlockInfo): string[] {
  const label = name === 'default' ? 'default block' : `\`<:${name}>\``;
  const lines = [`- ${label}${block.description ? `: ${cell(block.description)}` : ''}`];

  for (const param of block.params) {
    if (isBlockParam(param)) {
      lines.push(`  - yields ${describeParam(param)}`);
    } else {
      lines.push('  - yields a hash:');

      for (const [key, entry] of Object.entries(param)) {
        lines.push(`    - \`${key}\`: ${paramType(entry)}`);
      }
    }
  }

  return lines;
}

/** The signature as Markdown, in place of the props table React docgen gives Storybook. */
export function apiDescription(signature: ComponentSignature): string {
  const sections: string[] = [];
  const args = Object.entries(signature.args);

  if (args.length > 0) {
    sections.push(
      [
        '## Arguments',
        '',
        '| Name | Type | Default | Description |',
        '| --- | --- | --- | --- |',
        ...args.map(
          ([name, arg]) =>
            `| \`@${name}\`${arg.required ? ' (required)' : ''} | \`${cell(arg.type.raw)}\` | ${
              arg.defaultValue ? `\`${cell(arg.defaultValue)}\`` : ''
            } | ${cell(arg.description)} |`
        )
      ].join('\n')
    );
  }

  const blocks = Object.entries(signature.blocks);

  if (blocks.length > 0) {
    sections.push(
      ['## Blocks', '', ...blocks.flatMap(([name, block]) => describeBlock(name, block))].join('\n')
    );
  }

  if (signature.element) {
    sections.push(`## Element\n\n\`...attributes\` are applied to \`${signature.element}\`.`);
  }

  return sections.join('\n\n');
}

interface PackageInfo {
  name: string;
  dir: string;
}

function findPackage(from: string): PackageInfo | undefined {
  let dir = path.dirname(from);

  while (dir !== path.dirname(dir)) {
    const file = path.join(dir, 'package.json');

    if (existsSync(file)) {
      const { name } = JSON.parse(readFileSync(file, 'utf8')) as { name?: string };

      return name ? { name, dir } : undefined;
    }

    dir = path.dirname(dir);
  }

  return undefined;
}

/** `import Button from 'my-addon/components/button';`, assuming a v2 addon's `src/` maps to its exports. */
function importStatement(componentFile: string, name: string): string | undefined {
  const pkg = findPackage(componentFile);

  if (!pkg) return undefined;

  const specifier = path
    .relative(pkg.dir, componentFile)
    .replace(/^src\//, '')
    .replace(/\.[gj]ts$|\.[jt]s$/, '');

  return `import ${name} from '${pkg.name}/${specifier}';`;
}

function componentId(storyId: string): string {
  return storyId.split('--', 1)[0] ?? storyId;
}

/** Storybook's components manifest, read by `@storybook/addon-mcp` and served at `/manifests/components.json`. */
export async function buildComponentsManifest(entries: IndexEntry[]): Promise<ComponentsManifest> {
  const byStoryFile = new Map<string, IndexEntry[]>();

  for (const entry of entries) {
    const group = byStoryFile.get(entry.importPath) ?? [];

    group.push(entry);
    byStoryFile.set(entry.importPath, group);
  }

  const storyFiles = new Map<string, StoryFile | undefined>();

  for (const file of byStoryFile.keys()) {
    storyFiles.set(file, parseStoryFile(path.resolve(file)));
  }

  const componentFiles = new Set(
    storyFiles
      .values()
      .flatMap((parsed) => (parsed?.component.file ? [path.resolve(parsed.component.file)] : []))
  );
  // runTypeDoc keys files relative to the tsconfig's directory.
  const base = resolveTsconfigBase() ?? process.cwd();
  const extracted = await runTypeDoc(componentFiles.values().toArray());
  const signatures = new Map(
    Object.entries(extracted).map(([file, sigs]) => [path.resolve(base, file), sigs])
  );
  const components: Record<string, ComponentManifest> = {};

  for (const [file, group] of byStoryFile) {
    const parsed = storyFiles.get(file);
    const [first] = group as [IndexEntry, ...IndexEntry[]];

    // Docs-only pages (a standalone MDX file) document no component.
    if (group.every((entry) => entry.type !== 'story')) continue;

    const id = componentId(first.id);
    const componentFile = parsed?.component.file ? path.resolve(parsed.component.file) : undefined;
    const signatureName = parsed?.component.signatureName;
    const signature =
      componentFile && signatureName ? signatures.get(componentFile)?.[signatureName] : undefined;
    // Only a default export's real name needs the component file; any other
    // export is invoked by its signature name.
    const name =
      parsed?.component.name ??
      (signatureName && signatureName !== Default ? signatureName : undefined) ??
      parsed?.meta.component ??
      first.title.split('/').at(-1) ??
      id;

    components[id] = {
      id,
      name,
      path: file,
      description: parsed?.docs.description,
      import: componentFile ? importStatement(componentFile, name) : undefined,
      apiDescription: signature ? apiDescription(signature) : undefined,
      jsDocTags: {},
      stories: group
        // `Story.test(...)` entries are tests of their parent story, not examples.
        .filter((entry) => entry.type === 'story' && entry.subtype !== 'test')
        .map((entry) => {
          const story = parsed?.stories.find((candidate) => candidate.id === entry.id);
          const docs = parsed?.docs.stories[entry.id];
          const args = { ...parsed?.docs.args, ...docs?.args };
          const snippet = story?.inlineTemplate
            ? resolveTemplateArgs(story.inlineTemplate, args)
            : componentSource(name, signature, args, {});

          return { id: entry.id, name: entry.name, description: docs?.description, snippet };
        })
    };
  }

  return { v: 0, components };
}
