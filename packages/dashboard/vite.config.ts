import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
// import devtools from 'solid-devtools/vite';

export default defineConfig({
  plugins: [
    /* 
    Uncomment the following line to enable solid-devtools.
    For more info see https://github.com/thetarnav/solid-devtools/tree/main/packages/extension#readme
    */
    // devtools(),
    solidPlugin(),
  ],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'solid-js',
  },
  css: {
    modules: {
      localsConvention: 'camelCase', // or 'camelCaseOnly', etc.
    },
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api'],
        math: 'always',
        relativeUrls: true,
        javascriptEnabled: true,
      },
    },
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
});
