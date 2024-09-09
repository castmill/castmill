/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import legacy from '@vitejs/plugin-legacy';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    legacy({
      targets: {
        chrome: '38',
      },
      renderModernChunks: false,
      polyfills: [
        'es.promise.finally',
        'es/map',
        'es/set',
        'es.object.assign',
        'web.queue-microtask',
      ],
    }),
    /* 
    Uncomment the following line to enable solid-devtools.
    For more info see https://github.com/thetarnav/solid-devtools/tree/main/packages/extension#readme
    */
    // devtools(),
    solidPlugin(),
  ],
  base: '',
  publicDir: 'public',
  server: {
    port: 3001,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // setupFiles: ['node_modules/@testing-library/jest-dom/vitest'],
    // if you have few tests, try commenting this
    // out to improve performance:
    isolate: false,
  },
  build: {
    minify: false,
    sourcemap: 'inline',
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
