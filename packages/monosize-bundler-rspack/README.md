# monosize-bundler-rspack

## Installation

```sh
# npm
npm install monosize-bundler-rspack --save-dev
# yarn
yarn add monosize-bundler-rspack --dev
```

## Configuration

You need to update your `monosize.config.mjs` to use `monosize-bundler-rspack`:

```js
// monosize.config.mjs
import rspackBundler from 'monosize-bundler-rspack';

export default {
  // ...
  bundler: rspackBundler(config => {
    // customize config here
    return config;
  }),
};
```

`rspackBundler` is a function that accepts a callback to customize the rsbuild configuration. The callback receives the default rsbuild configuration and should return the updated configuration.

### Customizing configuration

You can customize the configuration by modifying the default configuration:

```js
// monosize.config.mjs
import rspackBundler from 'monosize-bundler-rspack';

export default {
  // ...
  bundler: rspackBundler(config => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      'some-package': 'some-package/dist/some-package.esm.js',
    };

    return config;
  }),
};
```

## Performance Optimization

### Single Build Mode

The Rsbuild (Rspack) bundler supports a single-build mode that can significantly improve build performance when measuring multiple fixtures. Instead of running a separate Rsbuild build for each fixture, this mode runs a single build with multiple entry points.

To enable single-build mode, use the `--single-build` flag with the `measure` command:

```sh
monosize measure --single-build
```

**Performance benefits:**
- Significant speedup for typical monorepo scenarios
- Reduced overhead from Rsbuild initialization and configuration
- Single shared cache and compilation context

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
