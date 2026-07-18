import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { describe, test, expect, beforeAll, afterAll } from 'vitest';

import { Application } from 'typedoc';
import ts from 'typescript';

import { createEmberHost } from '../src/ember-host.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const pluginPath = resolve(__dirname, '../dist/index.mjs');

describe('typedoc-plugin-ember', () => {
  let tmpDir: string;
  let gtsPath: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'typedoc-plugin-ember-test-'));

    writeFileSync(join(tmpDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'esnext',
        module: 'esnext',
        moduleResolution: 'bundler',
        strict: true,
        skipLibCheck: true,
      },
      include: ['./'],
    }));

    // Dummy .ts so the tsconfig has at least one input
    writeFileSync(join(tmpDir, 'dummy.ts'), 'export const x = 1;\n');

    gtsPath = join(tmpDir, 'greeting.gts');
    writeFileSync(gtsPath, `
      export interface GreetingSignature {
        Args: {
          name: string;
        };
        Blocks: {
          default: [];
        };
        Element: HTMLDivElement;
      }

      export default class Greeting {
        <template><div>Hello {{@name}}</div></template>
      }
    `);
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('should convert .gts files via plugin app.convert()', async () => {
    const app = await Application.bootstrapWithPlugins({
      entryPoints: [gtsPath],
      tsconfig: join(tmpDir, 'tsconfig.json'),
      plugin: [pluginPath],
      skipErrorChecking: true,
    });

    const project = await app.convert();

    expect(project).toBeDefined();
    expect(project!.children).toBeDefined();
    expect(project!.children!.length).toBeGreaterThan(0);

    const greeting = project!.children!.find((c) => c.name === 'default');
    expect(greeting).toBeDefined();

    const sig = project!.children!.find((c) => c.name === 'GreetingSignature');
    expect(sig).toBeDefined();
  });

  test('should convert via manual program creation', async () => {
    const app = await Application.bootstrapWithPlugins({
      entryPoints: [],
      tsconfig: join(tmpDir, 'tsconfig.json'),
      skipErrorChecking: true,
    });

    const compilerOptions = app.options.getCompilerOptions(app.logger);
    const host = createEmberHost(
      ts.createCompilerHost(compilerOptions),
      ts
    );

    const virtualPath = gtsPath + '.ts';

    const program = ts.createProgram({
      rootNames: [virtualPath],
      options: compilerOptions,
      host,
    });

    const sf = program.getSourceFile(virtualPath);
    expect(sf).toBeDefined();

    const entryPoints = [{
      displayName: basename(gtsPath, extname(gtsPath)),
      sourceFile: sf!,
      program,
    }];

    await app.initializeRepositories(entryPoints);
    const project = app.converter.convert(entryPoints);

    expect(project).toBeDefined();
    expect(project!.children).toBeDefined();
    expect(project!.children!.length).toBeGreaterThan(0);

    const greeting = project!.children!.find((c) => c.name === 'default');
    expect(greeting).toBeDefined();

    const sig = project!.children!.find((c) => c.name === 'GreetingSignature');
    expect(sig).toBeDefined();
  });
});
