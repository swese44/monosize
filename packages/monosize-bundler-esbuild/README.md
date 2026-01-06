# monosize-bundler-esbuild

## Installation

```sh
# npm
npm install monosize-bundler-esbuild --save-dev
# yarn
yarn add monosize-bundler-esbuild --dev
```

## Configuration

You need to update your `monosize.config.mjs` to use `monosize-bundler-esbuild`:

```js
// monosize.config.mjs
import esbuildBundler from 'monosize-bundler-esbuild';

export default {
  // ...
  bundler: esbuildBundler(config => {
    // customize config here
    return config;
  }),
};
```

`esbuildBundler` is a function that accepts a callback to customize the configuration. The callback receives the default esbuild configuration and should return the updated configuration.

### Customizing configuration

You can customize the configuration by modifying the default configuration:

```js
// monosize.config.mjs
import esbuildBundler from 'monosize-bundler-esbuild';

export default {
  // ...
  bundler: esbuildBundler(config => {
    config.loader = {
      ...config.loader,
      '.svg': 'file',
    };

    return config;
  }),
};
```

## Performance Optimization

### Single Build Mode

The esbuild bundler supports a single-build mode that can significantly improve build performance when measuring multiple fixtures. Instead of running a separate esbuild build for each fixture, this mode runs a single build with multiple entry points.

To enable single-build mode, use the `--single-build` flag with the `measure` command:

```sh
monosize measure --single-build
```

**Performance benefits:**
- Significant speedup for typical monorepo scenarios
- Reduced overhead from esbuild initialization and configuration
- Single shared compilation context

**When to use:**
- Large monorepos with many fixtures
- CI/CD pipelines where build time matters
- Local development for faster feedback

**Example:**

```sh
# Standard mode (builds each fixture separately)
monosize measure

# Single-build mode (builds all fixtures together)
monosize measure --single-build
# Significantly faster
```
