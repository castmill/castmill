import { defineConfig } from 'vite';
import { resolve } from 'path';
import babel from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import arrowFunctions from '@babel/plugin-transform-arrow-functions';
import legacy from '@vitejs/plugin-legacy';
import vue from '@vitejs/plugin-vue';

import solidPlugin from 'vite-plugin-solid';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    emptyOutDir: false,
    sourcemap: true,

    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'castmill-player',
      fileName: (format) => `index.js`,
      formats: ['es'],
    },

    rollupOptions: {
      plugins: [
        nodeResolve(),
        /*
        babel({
          babelHelpers: "bundled",
          plugins: [arrowFunctions],
          presets: [
            [
              "@babel/preset-env",
              {
                corejs: 2,
                useBuiltIns: "usage",
                targets: {
                  chrome: "1",
                },
              },
            ],
          ],
        }),
        */
      ],
      input: {
        // demo: resolve(__dirname, "demos/index.html"),
        // webos: resolve(__dirname, "demos/webos/index.html"),
        lib: resolve(__dirname, 'src/index.ts'),
      },
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      // external: ["vue", "gsap", "lodash", "rxjs"],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        dir: 'dist/',
        format: 'es',
      },
    },
  },
  // root: __dirname + "/demos",
  plugins: [
    solidPlugin(),
    /*
    legacy({
      targets: ["chrome 39"],
    }),
    */
  ],
  resolve: {
    dedupe: ['solid-js'],
  },
});
