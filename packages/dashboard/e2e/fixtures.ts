import { test as base, expect, type Page, type Route } from '@playwright/test';

/**
 * Offline fixtures for the responsive end-to-end checks.
 *
 * The dashboard talks to the Phoenix backend at `http://localhost:4000`
 * (see `src/env.ts`). Every request to that origin is fulfilled here, so the
 * suite needs only the Vite dev server and no database.
 */

export const API_ORIGIN = 'http://localhost:4000';
export const ORG_ID = 'org-e2e';
export const USER_ID = 'user-e2e';
export const AUTH_TOKEN = 'e2e-token';

const now = '2026-01-01T00:00:00Z';

const user = {
  id: USER_ID,
  name: 'Responsive Tester',
  email: 'tester@example.com',
  email_verified: true,
  network_id: 'network-e2e',
  is_root: false,
};

const organization = {
  id: ORG_ID,
  name: 'Acme Signage',
  role: 'admin',
  onboarding_completed: true,
  created_at: now,
  updated_at: now,
};

const teams = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  name: `Team with a fairly long name number ${i + 1}`,
  inserted_at: now,
  updated_at: now,
}));

const tags = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  name: `Tag ${i + 1}`,
  color: ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2'][i],
  organization_id: ORG_ID,
  position: i,
  inserted_at: now,
  updated_at: now,
}));

const channels = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  name: `Lobby screens channel ${i + 1}`,
  timezone: 'Europe/Stockholm',
  default_playlist_id: null,
  inserted_at: now,
  updated_at: now,
}));

const page = <T>(data: T[]) => ({ data, count: data.length });

/** JSON bodies for the endpoints the core pages call, keyed by path. */
function bodyFor(path: string, url: URL): unknown {
  if (path === '/sessions' || path === '/sessions/') {
    return { status: 'ok', user, token: AUTH_TOKEN };
  }
  if (path === `/dashboard/users/${USER_ID}/organizations`) {
    return { data: [organization] };
  }
  if (path === `/dashboard/users/${USER_ID}`) {
    return { data: user };
  }
  if (path === '/dashboard/addons' || path === '/dashboard/addons/') {
    return [];
  }
  if (path === `/dashboard/organizations/${ORG_ID}`) {
    return { data: organization };
  }
  if (path.endsWith('/permissions')) {
    return {
      role: 'admin',
      permissions: Object.fromEntries(
        [
          'teams',
          'tags',
          'channels',
          'playlists',
          'medias',
          'devices',
          'widgets',
          'layouts',
        ].map((r) => [r, ['list', 'show', 'create', 'update', 'delete']])
      ),
      resources: [
        'teams',
        'tags',
        'channels',
        'playlists',
        'medias',
        'devices',
        'widgets',
        'layouts',
      ],
    };
  }
  if (path === `/dashboard/organizations/${ORG_ID}/teams`) {
    return page(teams);
  }
  if (path === `/dashboard/organizations/${ORG_ID}/tags`) {
    return { data: tags };
  }
  if (path === `/dashboard/organizations/${ORG_ID}/channels`) {
    return page(channels);
  }
  if (/\/channels\/\d+$/.test(path)) {
    const id = Number(path.split('/').pop());
    return { data: channels.find((c) => c.id === id) ?? channels[0] };
  }
  if (path === `/dashboard/users/${USER_ID}/onboarding-progress`) {
    return {
      data: {
        completed_steps: [],
        current_step: null,
        is_completed: true,
        dismissed: true,
      },
    };
  }
  if (path.endsWith('/usage')) {
    return {};
  }
  if (path.includes('/notifications')) {
    return { data: [], count: 0, unread_count: 0 };
  }
  if (url.searchParams.has('page') || url.searchParams.has('page_size')) {
    return page([]);
  }
  return { data: [] };
}

/** Request paths that hit the mock but had no explicit fixture. */
export type ApiLog = string[];

async function fulfil(route: Route, log: ApiLog) {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() !== 'GET') {
    await route.fulfill({ status: 200, json: { data: {} } });
    return;
  }
  log.push(url.pathname + url.search);
  await route.fulfill({ status: 200, json: bodyFor(url.pathname, url) });
}

export interface DashboardOptions {
  theme: 'light' | 'dark';
  locale: string;
  authenticated: boolean;
}

/** Seeds localStorage and mocks the backend before the app boots. */
export async function prepareDashboard(
  page: Page,
  options: DashboardOptions,
  log: ApiLog = []
) {
  // Keep the run hermetic: third-party requests (fonts, flags) are dropped.
  await page.route(
    (url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
    (route) => route.abort()
  );
  await page.route(`${API_ORIGIN}/**`, (route) => fulfil(route, log));
  // The Phoenix user socket is not needed for layout checks.
  await page.routeWebSocket(/localhost:4000/, () => {});
  await page.addInitScript(
    ({ token, theme, locale, authenticated }) => {
      localStorage.setItem('castmill_theme', theme);
      localStorage.setItem('castmill_locale', locale);
      if (authenticated) {
        localStorage.setItem('castmill_auth_token', token);
      } else {
        localStorage.removeItem('castmill_auth_token');
      }
    },
    { token: AUTH_TOKEN, ...options }
  );
}

/**
 * Installs a virtual platform authenticator (Chromium only) so pages that
 * require passkey support, such as sign-up, render.
 */
export async function enablePasskeys(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
}

/**
 * Asserts the page itself never scrolls sideways. Wide content (tables,
 * calendars) must scroll inside its own container instead.
 */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const offenders: string[] = [];
    if (root.scrollWidth > root.clientWidth + 1) {
      const width = root.clientWidth;
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && (rect.right > width + 1 || rect.left < -1)) {
          offenders.push(
            `${el.tagName.toLowerCase()}.${String(
              (el as HTMLElement).className || ''
            )
              .split(' ')
              .slice(0, 2)
              .join('.')} [${Math.round(rect.left)}, ${Math.round(rect.right)}]`
          );
          if (offenders.length >= 5) break;
        }
      }
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      offenders,
    };
  });
  expect(
    overflow.scrollWidth,
    `page overflows horizontally: ${overflow.offenders.join(', ')}`
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

export const test = base;
export { expect };
