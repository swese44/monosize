import fs from 'node:fs';
import path from 'node:path';
import tmp from 'tmp';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { createWebpackBundler } from './createWebpackBundler.mjs';

async function setup(fixtureContent: string): Promise<string> {
  const packageDir = tmp.dirSync({
    prefix: 'buildFixture',
    unsafeCleanup: true,
  });

  const spy = vitest.spyOn(process, 'cwd');
  spy.mockReturnValue(packageDir.name);

  const fixtureDir = tmp.dirSync({
    dir: packageDir.name,
    name: 'monosize',
    unsafeCleanup: true,
  });
  const fixture = tmp.fileSync({
    dir: fixtureDir.name,
    name: 'test.fixture.js',
  });

  await fs.promises.writeFile(fixture.name, fixtureContent);

  return fixture.name;
}

async function setupMultiple(
  fixtures: Array<{ name: string; content: string }>,
): Promise<{ dir: string; fixtures: Array<{ name: string; path: string }> }> {
  const packageDir = tmp.dirSync({
    prefix: 'buildFixtures',
    unsafeCleanup: true,
  });

  const spy = vitest.spyOn(process, 'cwd');
  spy.mockReturnValue(packageDir.name);

  const fixtureDir = tmp.dirSync({
    dir: packageDir.name,
    name: 'monosize',
    unsafeCleanup: true,
  });

  const fixtureResults = await Promise.all(
    fixtures.map(async ({ name, content }) => {
      const fixture = tmp.fileSync({
        dir: fixtureDir.name,
        name: `${name}.fixture.js`,
      });
      await fs.promises.writeFile(fixture.name, content);
      return { name, path: fixture.name };
    }),
  );

  return { dir: fixtureDir.name, fixtures: fixtureResults };
}

const webpackBundler = createWebpackBundler(config => {
  // Disable pathinfo to make the output deterministic in snapshots
  config.output ??= {};
  config.output.pathinfo = false;

  return config;
});

describe('buildFixture', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('builds fixtures', async () => {
    const fixturePath = await setup(`
      const hello = 'Hello';
      const world = 'world';

      console.log(hello);
    `);
    const buildResult = await webpackBundler.buildFixture({
      debug: false,
      fixturePath,
      quiet: true,
    });

    expect(buildResult.outputPath).toMatch(/monosize[\\|/]test\.output\.js/);
    expect(await fs.promises.readFile(buildResult.outputPath, 'utf-8')).toMatchInlineSnapshot(
      `"console.log("Hello");"`,
    );
  });

  it('should throw on compilation errors', async () => {
    const fixturePath = await setup(`import something from 'unknown-pkg'`);
    await expect(
      webpackBundler.buildFixture({
        debug: false,
        fixturePath,
        quiet: true,
      }),
    ).rejects.toBeDefined();
  });

  describe('debug mode', () => {
    it('does not output additional files when disabled', async () => {
      const fixturePath = await setup(`
      const tokens = {
        foo: 'foo',
        bar: 'bar',
      };
      function foo () { return tokens.foo; }
      const bar = 1;

      console.log(foo);
    `);
      const buildResult = await webpackBundler.buildFixture({
        debug: false,
        fixturePath,
        quiet: true,
      });
      const output = await fs.promises.readFile(buildResult.outputPath, 'utf-8');

      expect(buildResult.outputPath).toMatch(/monosize[\\|/]test\.output\.js/);
      expect(buildResult.debugOutputPath).toBeUndefined();

      expect(output).toMatchInlineSnapshot(`"(()=>{const o="foo";console.log((function(){return o}))})();"`);
    });

    it('provides partially minified output when enabled', async () => {
      const fixturePath = await setup(`
      const tokens = {
        foo: 'foo',
        bar: 'bar',
      };
      function foo () { return tokens.foo; }
      const bar = 1;

      console.log(foo);
    `);
      const buildResult = await webpackBundler.buildFixture({
        debug: true,
        fixturePath,
        quiet: true,
      });

      expect(buildResult.outputPath).toMatch(/monosize[\\|/]test\.output\.js/);
      expect(buildResult.debugOutputPath).toMatch(/monosize[\\|/]test\.debug\.js/);

      const output = await fs.promises.readFile(buildResult.outputPath, 'utf-8');
      const debugOutput = await fs.promises.readFile(buildResult.debugOutputPath!, 'utf-8');

      expect(output).toMatchInlineSnapshot(`"(()=>{const o="foo";console.log((function(){return o}))})();"`);

      // Output should contain the original variable names
      expect(debugOutput).toMatchInlineSnapshot(`
        "/******/ (() => {
            // webpackBootstrap
            const tokens_foo = "foo";
            console.log((function() {
                return tokens_foo;
            }));
        })
        /******/ ();"
      `);
    });
  });
});

describe('buildFixtures', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('builds multiple fixtures in a single build', async () => {
    const { fixtures } = await setupMultiple([
      {
        name: 'fixture1',
        content: `
          const hello = 'Hello';
          console.log(hello);
        `,
      },
      {
        name: 'fixture2',
        content: `
          const world = 'World';
          console.log(world);
        `,
      },
      {
        name: 'fixture3',
        content: `
          const test = 'Test';
          console.log(test);
        `,
      },
    ]);

    const buildResults = await webpackBundler.buildFixtures!({
      fixtures: fixtures.map(f => ({ fixturePath: f.path, name: f.name })),
      debug: false,
      quiet: true,
    });

    expect(buildResults).toHaveLength(3);

    // Check that all files were created
    expect(buildResults[0].name).toBe('fixture1');
    expect(buildResults[0].outputPath).toMatch(/monosize[\\|/]fixture1\.output\.js/);
    expect(await fs.promises.readFile(buildResults[0].outputPath, 'utf-8')).toMatchInlineSnapshot(
      `"console.log("Hello");"`,
    );

    expect(buildResults[1].name).toBe('fixture2');
    expect(buildResults[1].outputPath).toMatch(/monosize[\\|/]fixture2\.output\.js/);
    expect(await fs.promises.readFile(buildResults[1].outputPath, 'utf-8')).toMatchInlineSnapshot(
      `"console.log("World");"`,
    );

    expect(buildResults[2].name).toBe('fixture3');
    expect(buildResults[2].outputPath).toMatch(/monosize[\\|/]fixture3\.output\.js/);
    expect(await fs.promises.readFile(buildResults[2].outputPath, 'utf-8')).toMatchInlineSnapshot(
      `"console.log("Test");"`,
    );
  });

  it('builds multiple fixtures in debug mode', async () => {
    const { fixtures } = await setupMultiple([
      {
        name: 'fixture1',
        content: `
          const tokens = { foo: 'foo' };
          console.log(tokens.foo);
        `,
      },
      {
        name: 'fixture2',
        content: `
          const tokens = { bar: 'bar' };
          console.log(tokens.bar);
        `,
      },
    ]);

    const buildResults = await webpackBundler.buildFixtures!({
      fixtures: fixtures.map(f => ({ fixturePath: f.path, name: f.name })),
      debug: true,
      quiet: true,
    });

    expect(buildResults).toHaveLength(2);

    // Check that debug files were created
    expect(buildResults[0].debugOutputPath).toMatch(/monosize[\\|/]fixture1\.debug\.js/);
    expect(buildResults[1].debugOutputPath).toMatch(/monosize[\\|/]fixture2\.debug\.js/);

    // Verify debug files exist and contain content
    const debugOutput1 = await fs.promises.readFile(buildResults[0].debugOutputPath!, 'utf-8');
    const debugOutput2 = await fs.promises.readFile(buildResults[1].debugOutputPath!, 'utf-8');

    expect(debugOutput1.length).toBeGreaterThan(0);
    expect(debugOutput2.length).toBeGreaterThan(0);
  });

  it('should throw on compilation errors in any fixture', async () => {
    const { fixtures } = await setupMultiple([
      {
        name: 'fixture1',
        content: `console.log('valid');`,
      },
      {
        name: 'fixture2',
        content: `import something from 'unknown-pkg';`,
      },
    ]);

    await expect(
      webpackBundler.buildFixtures!({
        fixtures: fixtures.map(f => ({ fixturePath: f.path, name: f.name })),
        debug: false,
        quiet: true,
      }),
    ).rejects.toBeDefined();
  });

  it('produces identical output whether using buildFixture or buildFixtures', async () => {
    // Create test fixtures with realistic content
    const fixtureContents = [
      {
        name: 'component1',
        content: `
          const Component1 = {
            name: 'Component1',
            value: 42,
            render: function() {
              return 'Hello from Component1: ' + this.value;
            }
          };
          export default Component1;
        `,
      },
      {
        name: 'component2',
        content: `
          const Component2 = {
            name: 'Component2',
            data: [1, 2, 3, 4, 5],
            process: function() {
              return this.data.map(x => x * 2);
            }
          };
          export default Component2;
        `,
      },
      {
        name: 'component3',
        content: `
          const Component3 = {
            name: 'Component3',
            greeting: 'World',
            getMessage: function() {
              return 'Hello, ' + this.greeting + '!';
            }
          };
          export default Component3;
        `,
      },
    ];

    // Build using loop mode (buildFixture for each)
    const { fixtures: loopFixtures } = await setupMultiple(fixtureContents);
    const loopOutputs: Array<{ name: string; content: string }> = [];

    for (const fixture of loopFixtures) {
      const result = await webpackBundler.buildFixture({
        fixturePath: fixture.path,
        debug: false,
        quiet: true,
      });
      const content = await fs.promises.readFile(result.outputPath, 'utf-8');
      loopOutputs.push({ name: fixture.name, content });
    }

    // Build using single-build mode (buildFixtures)
    const { fixtures: batchFixtures } = await setupMultiple(fixtureContents);
    const batchResults = await webpackBundler.buildFixtures!({
      fixtures: batchFixtures.map(f => ({ fixturePath: f.path, name: f.name })),
      debug: false,
      quiet: true,
    });

    const batchOutputs = await Promise.all(
      batchResults.map(async result => ({
        name: result.name,
        content: await fs.promises.readFile(result.outputPath, 'utf-8'),
      })),
    );

    // Sort both arrays by name to ensure consistent ordering
    loopOutputs.sort((a, b) => a.name.localeCompare(b.name));
    batchOutputs.sort((a, b) => a.name.localeCompare(b.name));

    // Verify we have the same number of outputs
    expect(batchOutputs).toHaveLength(loopOutputs.length);

    // Compare each output
    for (let i = 0; i < loopOutputs.length; i++) {
      expect(batchOutputs[i].name).toBe(loopOutputs[i].name);
      // The bundle contents should be identical
      expect(batchOutputs[i].content).toBe(loopOutputs[i].content);
    }
  });
});
