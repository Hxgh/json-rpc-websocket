import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2023',
      dts: true
    }
  ],
  output: {
    copy: [{ from: './public' }, { from: 'README.md' }],
    minify: {
      js: true,
      css: false,
      jsOptions: {
        minimizerOptions: {
          mangle: false,
          // 启用压缩
          minify: true,
          compress: {
            defaults: false,
            unused: true,
            dead_code: true,
            // 避免 remoteEntry 的全局变量被 tree-shaking
            toplevel: false
          },
          format: {
            comments: 'some',
            preserve_annotations: true
          }
        }
      }
    }
  }
});
