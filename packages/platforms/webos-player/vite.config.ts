/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import legacy from '@vitejs/plugin-legacy';
import { viteStaticCopy } from 'vite-plugin-static-copy';
// import devtools from 'solid-devtools/vite';

export default defineConfig({
  plugins: [
    legacy({
      targets: {
        chrome: '38',
      },
      renderModernChunks: false,
      // polyfills: false,
      polyfills: [
        'es.promise.finally',
        'es/map',
        'es/set',
        'es.object.assign',
        'web.queue-microtask',
      ],
      // externalSystemJS: true,
      // additionalLegacyPolyfills: ['es6.symbol'],
    }),
    /* 
    Uncomment the following line to enable solid-devtools.
    For more info see https://github.com/thetarnav/solid-devtools/tree/main/packages/extension#readme
    */
    // devtools(),
    solidPlugin(),
    // viteStaticCopy({
    //   targets: [],
    // //   targets: [
    // //     {
    // //       'src': 'lib',
    // //       'dest': 'dist/lib'
    // //     },
    // //   ],
    // }),
  ],
  base: '',
  // root: '.',
  publicDir: 'public',
  server: {
    port: 3001,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['node_modules/@testing-library/jest-dom/vitest'],
    // if you have few tests, try commenting this
    // out to improve performance:
    isolate: false,
  },
  build: {
    // target: 'chrome38',
    minify: false,
    sourcemap: 'inline',
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
