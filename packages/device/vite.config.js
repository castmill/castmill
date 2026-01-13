import { resolve } from 'path';

import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

// Read package.json version
import { readFileSync } from 'fs';
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8')
);

export default defineConfig({
  plugins: [solidPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
    sourcemap: 'inline',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'castmill-player',
      fileName: (format) => `index.js`,
      formats: ['es'],
    },
  },
});
