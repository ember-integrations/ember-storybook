// Compares what agents get from a Storybook built with the components manifest
// against one built with the docgen server: every component's name,
// description, API, import and story snippets must match.
//
//   node compare-docgen.mjs <manifest build> <docgen server build>

import { readFileSync } from 'node:fs';
import path from 'node:path';

const [manifestDir, serverDir] = process.argv.slice(2);
const read = (...parts) => JSON.parse(readFileSync(path.join(...parts), 'utf8'));
const manifest = read(manifestDir, 'manifests/components.json');
const index = read(serverDir, 'manifests/components.json');
const failures = [];

const ids = Object.keys(manifest.components);

if (ids.length === 0) failures.push('the manifest has no components');

for (const id of Object.keys(index.components)) {
  if (!manifest.components[id]) failures.push(`${id}: missing from the manifest`);
}

// Components that failed to extract match in both builds; at least some must have an API.
if (!Object.values(manifest.components).some((component) => component.apiDescription)) {
  failures.push('no component has an API description');
}

if (manifest.v !== 0 || index.v !== 1) {
  failures.push(`expected manifest v0 and index v1, got v${manifest.v} and v${index.v}`);
}

for (const [id, component] of Object.entries(manifest.components)) {
  if (!index.components[id]) {
    failures.push(`${id}: missing from the docgen server's index`);
    continue;
  }

  const docgen = read(serverDir, 'services/core/docgen', `${id}.json`).components[id] ?? {};
  const storyDocs = read(serverDir, 'services/core/story-docs', `${id}.json`).components[id] ?? {};
  const expected = {
    name: component.name,
    description: component.description,
    apiDescription: component.apiDescription,
    import: component.import,
    stories: component.stories.map(({ id, name, description, snippet }) => ({
      id,
      name,
      description,
      snippet
    }))
  };
  const actual = {
    name: docgen.name,
    description: docgen.description,
    apiDescription: docgen.apiDescription,
    import: storyDocs.import,
    stories: Object.values(storyDocs.stories ?? {}).map(({ id, name, description, snippet }) => ({
      id,
      name,
      description,
      snippet
    }))
  };

  for (const key of Object.keys(expected)) {
    if (JSON.stringify(expected[key]) !== JSON.stringify(actual[key])) {
      failures.push(`${id}: ${key} differs`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`${ids.length} components match.`);
