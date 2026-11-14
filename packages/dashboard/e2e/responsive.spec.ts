import {
  test,
  expect,
  prepareDashboard,
  expectNoHorizontalOverflow,
  enablePasskeys,
  ORG_ID,
} from './fixtures';
import type { Page, TestInfo } from '@playwright/test';

/**
 * Responsive checks for the dashboard shell, core pages and drawers.
 *
 * Every test runs in each viewport project from `playwright.config.ts`
 * (375×812 phone, 768×1024 and 1024×768 tablet, 1440×900 desktop). The
 * shared assertion is that the page never scrolls sideways; wide content
 * must scroll inside its own container.
 */

const PAGES = [
  { name: 'home', path: `/org/${ORG_ID}/` },
  { name: 'teams', path: `/org/${ORG_ID}/teams`, text: 'Team with a' },
  { name: 'tags', path: `/org/${ORG_ID}/tags`, text: 'Tag 1' },
  { name: 'channels', path: `/org/${ORG_ID}/channels`, text: 'Lobby screens' },
  { name: 'usage', path: `/org/${ORG_ID}/usage` },
  { name: 'organization', path: `/org/${ORG_ID}/organization` },
  { name: 'settings', path: '/settings' },
];

const viewportWidth = (page: Page) => page.viewportSize()?.width ?? 0;
/** Up to 48em the sidebar is an off-canvas drawer (`NAV_OFFCANVAS_QUERY`). */
const isOffCanvas = (page: Page) => viewportWidth(page) <= 768;
/** Up to 64em the sidebar collapses to a rail (`NAV_COLLAPSED_QUERY`). */
const isCollapsed = (page: Page) => viewportWidth(page) <= 1024;

/** Waits for slide-in transitions so measurements see the final position. */
async function settleAnimations(locator: import('@playwright/test').Locator) {
  await locator.evaluate((el) =>
    Promise.all(
      el
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined))
    )
  );
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
}

async function gotoReady(page: Page, path: string, text?: string) {
  await page.goto(path);
  await expect(page.locator('.castmill-header')).toBeVisible();
  if (text) {
    await expect(page.getByText(text).first()).toBeVisible();
  }
  // Let late layout (fonts, resize observers) settle before measuring.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve))
  );
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await prepareDashboard(page, {
        theme,
        locale: 'en',
        authenticated: true,
      });
    });

    for (const { name, path, text } of PAGES) {
      test(`${name} page fits the viewport`, async ({ page }, testInfo) => {
        await gotoReady(page, path, text);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expectNoHorizontalOverflow(page);
        await attachScreenshot(page, testInfo, `${name}-${theme}`);
      });
    }

    test('theme-color matches the theme', async ({ page }) => {
      await gotoReady(page, `/org/${ORG_ID}/`);
      await expect(
        page.locator('meta[name="theme-color"]').first()
      ).toHaveAttribute('content', theme === 'light' ? '#f4f6fa' : '#151925');
    });
  });
}

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => {
    await prepareDashboard(page, {
      theme: 'dark',
      locale: 'en',
      authenticated: true,
    });
  });

  test('sidebar adapts to the viewport', async ({ page }, testInfo) => {
    await gotoReady(page, `/org/${ORG_ID}/teams`, 'Team with a');
    const menuButton = page.getByTestId('topbar-menu-button');
    const panel = page.locator('.castmill-sidepanel');

    if (!isCollapsed(page)) {
      await expect(menuButton).toBeHidden();
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute('data-mode', 'static');
      return;
    }
    if (!isOffCanvas(page)) {
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute('data-mode', 'rail');
      await expect(panel).toBeInViewport({ ratio: 1 });
      return;
    }

    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toHaveAttribute('role', 'dialog');
    await settleAnimations(panel);
    await expect(panel).toBeInViewport({ ratio: 1 });
    await expectNoHorizontalOverflow(page);
    await attachScreenshot(page, testInfo, 'nav-drawer-open');

    await page.keyboard.press('Escape');
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  test('channel details drawer fits the viewport', async ({
    page,
  }, testInfo) => {
    await gotoReady(page, `/org/${ORG_ID}/channels?itemId=1`, 'Lobby screens');
    const drawer = page.locator('[data-drawer-panel]');
    await expect(drawer).toBeVisible();
    await settleAnimations(drawer);
    const box = await drawer.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    await expectNoHorizontalOverflow(page);
    await attachScreenshot(page, testInfo, 'channel-drawer');
  });
});

test.describe('Arabic (RTL)', () => {
  test.beforeEach(async ({ page }) => {
    await prepareDashboard(page, {
      theme: 'light',
      locale: 'ar',
      authenticated: true,
    });
  });

  for (const { name, path } of PAGES.filter((p) =>
    ['teams', 'channels', 'settings'].includes(p.name)
  )) {
    test(`${name} page is mirrored and fits`, async ({ page }, testInfo) => {
      await gotoReady(page, path);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
      await expectNoHorizontalOverflow(page);
      await attachScreenshot(page, testInfo, `${name}-rtl`);
    });
  }

  test('navigation drawer opens from the start edge', async ({ page }) => {
    test.skip(!isOffCanvas(page), 'Sidebar is inline at this width');
    await gotoReady(page, `/org/${ORG_ID}/teams`);
    await page.getByTestId('topbar-menu-button').click();
    const panel = page.locator('.castmill-sidepanel');
    await settleAnimations(panel);
    await expect(panel).toBeInViewport({ ratio: 1 });
    const box = (await panel.boundingBox())!;
    const width = page.viewportSize()!.width;
    // In RTL the start edge is on the right.
    expect(Math.round(box.x + box.width)).toBeGreaterThanOrEqual(width - 1);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('login and installability', () => {
  test.beforeEach(async ({ page }) => {
    await prepareDashboard(page, {
      theme: 'dark',
      locale: 'en',
      authenticated: false,
    });
  });

  for (const path of [
    '/login',
    '/signup?email=new.user%40example.com&signup_id=s1&challenge=AAAA',
  ]) {
    const name = path.slice(1).split('?')[0];
    test(`${name} page fits the viewport`, async ({ page }, testInfo) => {
      await enablePasskeys(page);
      await page.goto(path);
      await expect(page.locator('.login-box')).toBeVisible();
      await expect(page.locator('.login-box')).toBeInViewport({ ratio: 1 });
      await expectNoHorizontalOverflow(page);
      await attachScreenshot(page, testInfo, name);
    });
  }

  test('viewport meta opts into safe areas', async ({ page }) => {
    await page.goto('/login');
    const content = await page
      .locator('meta[name="viewport"]')
      .getAttribute('content');
    expect(content).toContain('viewport-fit=cover');
    expect(content).toContain('interactive-widget=resizes-content');
  });

  test('web app manifest and icons are served', async ({ page, request }) => {
    await page.goto('/login');
    const href = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');

    const manifest = await (await request.get(href!)).json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(
      manifest.icons.some((icon: { purpose?: string }) =>
        icon.purpose?.includes('maskable')
      )
    ).toBe(true);

    for (const icon of manifest.icons as { src: string }[]) {
      const response = await request.get(icon.src);
      expect(response.ok(), icon.src).toBe(true);
    }
    const touchIcon = await page
      .locator('link[rel="apple-touch-icon"]')
      .getAttribute('href');
    expect((await request.get(touchIcon!)).ok()).toBe(true);
  });
});
