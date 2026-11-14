import { defineConfig, devices } from '@playwright/test';

/**
 * Responsive end-to-end checks (`yarn e2e`).
 *
 * Runs the dashboard in Chromium at the phone, tablet and desktop sizes from
 * the responsive acceptance criteria. The backend is mocked in
 * `e2e/fixtures.ts`, so only the Vite dev server is started.
 *
 * Set `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome` to use an installed Chrome instead
 * of the Playwright-managed Chromium.
 */
const PORT = Number(process.env.E2E_PORT || 3000);
const channel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL;

const chromium = {
  ...devices['Desktop Chrome'],
  ...(channel ? { channel } : {}),
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'phone',
      use: {
        ...chromium,
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'tablet-portrait',
      use: {
        ...chromium,
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'tablet-landscape',
      use: {
        ...chromium,
        viewport: { width: 1024, height: 768 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'desktop',
      use: { ...chromium, viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `yarn vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
