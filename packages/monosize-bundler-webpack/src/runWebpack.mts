import path from 'node:path';
import TerserWebpackPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';
import type { Configuration as WebpackConfiguration } from 'webpack';

import { WebpackBundlerOptions } from './types.mjs';

/**
 * Creates the base Webpack configuration shared by both single and multi-entry builds.
 */
function createBaseWebpackConfig(debug: boolean): Partial<WebpackConfiguration> {
  return {
    name: 'client',
    target: 'web',
    mode: 'production',

    cache: {
      type: 'memory',
    },
    externals: {
      react: 'React',
      'react-dom': 'ReactDOM',
    },

    performance: {
      hints: false,
    },
    optimization: {
      minimizer: [
        new TerserWebpackPlugin({
          extractComments: false,
          terserOptions: {
            format: {
              comments: false,
            },
          },
        }),
      ],

      // If debug mode is enabled, we want to disable minification and rely on Terser to produce a partially minified
      // file for debugging purposes
      ...(debug && {
        minimize: false,
        minimizer: [],
      }),
    },

    ...(debug && {
      stats: {
        optimizationBailout: true,
      },
    }),
  };
}

function createWebpackConfig(fixturePath: string, outputPath: string, debug: boolean): WebpackConfiguration {
  return {
    ...createBaseWebpackConfig(debug),

    entry: fixturePath,
    output: {
      filename: path.basename(outputPath),
      path: path.dirname(outputPath),

      ...(debug && {
        pathinfo: true,
      }),
    },
  } as WebpackConfiguration;
}

function createMultiEntryWebpackConfig(
  fixtures: Array<{ fixturePath: string; outputPath: string }>,
  debug: boolean,
): WebpackConfiguration {
  // Build entry object with unique keys for each fixture
  const entry: Record<string, string> = {};
  const seenKeys = new Set<string>();

  fixtures.forEach(({ fixturePath, outputPath }, index) => {
    // Use the output filename (without extension) as the entry key
    let entryName = path.basename(outputPath, path.extname(outputPath));

    // Handle potential collisions by appending index
    if (seenKeys.has(entryName)) {
      entryName = `${entryName}_${index}`;
    }

    seenKeys.add(entryName);
    entry[entryName] = fixturePath;
  });

  // All fixtures should output to the same directory
  const outputDir = path.dirname(fixtures[0].outputPath);

  return {
    ...createBaseWebpackConfig(debug),

    entry,
    output: {
      filename: '[name].js',
      path: outputDir,

      ...(debug && {
        pathinfo: true,
      }),
    },
  } as WebpackConfiguration;
}

type RunWebpackOptions = {
  enhanceConfig: WebpackBundlerOptions;

  fixturePath: string;
  outputPath: string;

  debug: boolean;
  quiet: boolean;
};

export async function runWebpack(options: RunWebpackOptions): Promise<null> {
  const { enhanceConfig, fixturePath, outputPath, debug } = options;
  const webpackConfig = enhanceConfig(createWebpackConfig(fixturePath, outputPath, debug));

  return new Promise((resolve, reject) => {
    const compiler = webpack(webpackConfig);

    compiler.run((err, result) => {
      if (err) {
        reject(err);
      }
      if (result && result.hasErrors()) {
        reject(result.compilation.errors.join('\n'));
      }

      resolve(null);
    });
  });
}

type RunWebpackMultiEntryOptions = {
  enhanceConfig: WebpackBundlerOptions;

  fixtures: Array<{ fixturePath: string; outputPath: string }>;

  debug: boolean;
  quiet: boolean;
};

export async function runWebpackMultiEntry(options: RunWebpackMultiEntryOptions): Promise<null> {
  const { enhanceConfig, fixtures, debug } = options;
  const webpackConfig = enhanceConfig(createMultiEntryWebpackConfig(fixtures, debug));

  return new Promise((resolve, reject) => {
    const compiler = webpack(webpackConfig);

    compiler.run((err, result) => {
      if (err) {
        reject(err);
      }
      if (result && result.hasErrors()) {
        reject(result.compilation.errors.join('\n'));
      }

      resolve(null);
    });
  });
}
