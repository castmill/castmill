import { configDefaults, defineConfig } from 'vitest/config';
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
      '../castmill/lib/castmill/addons/devices/components/*.{test,spec}.?(c|m)[jt]s?(x)',
    ],
    exclude: [
      ...configDefaults.exclude,
      // Targets the pre-selection-toolbar devices UI; it was never part of this suite.
      '../castmill/lib/castmill/addons/devices/components/delete-permissions.test.tsx',
    ],
  },
});
