import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    testTransformMode: { web: ['/.[jt]sx?$/'] },
    setupFiles: ['./vitest-setup.ts'],
    include: [
      'src/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      '../castmill/lib/castmill/addons/**/services/*.{test,spec}.?(c|m)[jt]s?(x)',
    ],
  },
});
