import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts'],
    globals: true,
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'solid-js',
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
