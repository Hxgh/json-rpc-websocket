import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2021',
      dts: false, // 临时禁用，先完成 JS 构建
      source: {
        entry: {
          index: './src/index.ts',
        },
      },
    },
  ],
  output: {
    target: 'web',
    copy: [{ from: './public' }, { from: 'README.md' }],
    minify: {
      js: true,
      css: false,
      jsOptions: {
        minimizerOptions: {
          mangle: true,
          minify: true,
          compress: {
            arrows: true,
            booleans: true,
            collapse_vars: true,
            comparisons: true,
            computed_props: true,
            conditionals: true,
            dead_code: true,
            drop_console: false,
            drop_debugger: true,
            evaluate: true,
            if_return: true,
            inline: true,
            join_vars: true,
            loops: true,
            negate_iife: true,
            properties: true,
            reduce_funcs: true,
            reduce_vars: true,
            sequences: true,
            side_effects: true,
            switches: true,
            typeofs: true,
            unused: true,
            toplevel: false,
          },
          format: {
            comments: 'some',
            preserve_annotations: true,
          },
        },
      },
    },
  },
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
});
