// The documentation screenshots, grouped by the page that shows them. Each shot
// has a unique `id` (the image file stem) and either the dashboard `path` or a
// full `url` to open. Optional fields:
//   - waitFor: a selector to wait for before preparing the page
//   - prepare(page, ctx, theme): steps that bring the page into the right state
//   - selector: capture only this element (dialogs, panels) instead of the viewport
//   - viewport: overrides of the default 1440x900 viewport
//   - clip: capture only this area of the viewport ({ x, y, width, height })
//   - players: true if the demo players must be online
//   - anonymous: true to capture without signing in
//   - storage(ctx): localStorage entries to set before the page loads
//   - kiosk: true to report a Chrome kiosk on Linux, as the demo players do
//   - timeout: milliseconds an attempt may take (default 45000)
//   - settle: milliseconds to wait before the capture (default 800)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hardwareId } from './players.mjs';

const MEDIA = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '.cache',
  'media'
);
const MODAL = '[class*="modalContent"]';
const DRAWER = '[class*="drawerPanel"]';
// A device drawer whose player is connected.
const ONLINE = `${DRAWER} ::-p-text(Online)`;
const DEVICE = (ctx) =>
  `/org/${ctx.org()}/devices?itemId=${ctx.seed['Harbor Kitchen'].devices['Downtown – Menu board']}`;

const hk = (ctx) => `/org/${ctx.org()}`;
const id = (ctx, kind, name, org = 'Harbor Kitchen') => {
  const value = ctx.seed[org]?.[kind]?.[name];
  if (value === undefined) throw new Error(`No ${kind} "${name}" in the seed`);
  return value;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Clicks the first visible element matching `selector` that contains `text`. */
const clickText = (page, text, selector = 'button') =>
  page.locator(`${selector}::-p-text(${text})`).click();

/** Starts the playlist preview, which shows a play button while paused. */
async function playPreview(page, seconds = 2) {
  const preview = await page.waitForSelector('.playlist-preview', {
    visible: true,
  });
  await preview.click();
  await sleep(seconds * 1000);
}

/** Scrolls the channel calendar, and only the calendar, so that `label` is at its top. */
async function scrollCalendarTo(page, label = '08:00') {
  await page.evaluate((label) => {
    const cell = [...document.querySelectorAll('div, span, td')].find(
      (element) =>
        element.children.length === 0 && element.textContent.trim() === label
    );
    let scroller = cell?.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) {
      scroller = scroller.parentElement;
    }
    if (!cell || !scroller) return;
    const header = scroller.querySelector('thead, [class*="header"]');
    const offset = header ? header.getBoundingClientRect().height : 0;
    scroller.scrollTop +=
      cell.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top -
      offset;
  }, label);
}

/** Starts the preview of a widget settings dialog. */
async function playDialogPreview(page) {
  const preview = await page.waitForSelector(
    `${MODAL} [class*="widget-view"]`,
    { visible: true }
  );
  await preview.click();
}

/**
 * Waits until the browser player shows a slide: an image, or an element with a
 * background image, at least 1000 px wide, in any frame of the page.
 */
async function waitForSlide(page, timeout = 80_000) {
  const shown = () =>
    [...document.querySelectorAll('img, div')].some((element) => {
      const width = element.getBoundingClientRect().width;
      if (element instanceof HTMLImageElement)
        return element.complete && width >= 1000;
      return (
        width >= 1000 &&
        getComputedStyle(element).backgroundImage.startsWith('url(')
      );
    });
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (await frame.evaluate(shown).catch(() => false)) return;
    }
    await sleep(500);
  }
  throw new Error('The player showed no slide');
}

/** Opens the `index`th filter of a list page (0: team, 1: tags) and picks options. */
async function chooseFilter(page, index, options) {
  const triggers = await page.$$('button.msf-trigger');
  await triggers[index].click();
  for (const option of options) await clickText(page, option, '.msf-option');
}

/** Types into the input matching `selector`, replacing its value. */
async function fill(page, selector, value) {
  const input = await page.waitForSelector(selector, { visible: true });
  await input.click({ count: 3 });
  await input.type(value);
}

export const shots = [
  // dashboard/overview.md
  {
    id: 'overview-dashboard',
    path: (ctx) => `${hk(ctx)}/content/playlists`,
    waitFor: 'table',
  },
  {
    id: 'overview-search',
    path: (ctx) => `${hk(ctx)}/search?s=harbor`,
    waitFor: '::-p-text(Results for)',
  },
  {
    id: 'overview-shortcuts',
    path: (ctx) => `${hk(ctx)}/content/playlists`,
    waitFor: 'table',
    async prepare(page) {
      await page.keyboard.down('Shift');
      await page.keyboard.press('?');
      await page.keyboard.up('Shift');
    },
    selector: '.shortcuts-legend-modal',
  },

  // getting-started/first-screen.md and dashboard/media.md
  {
    id: 'media-upload',
    path: (ctx) => `${hk(ctx)}/content/medias`,
    waitFor: 'table',
    async prepare(page) {
      await clickText(page, 'Upload Media');
      const input = await page.waitForSelector(`${MODAL} input[type="file"]`);
      await input.uploadFile(
        path.join(MEDIA, 'weekend-brunch.jpg'),
        path.join(MEDIA, 'kitchen-highlights.mp4')
      );
    },
    selector: MODAL,
  },
  {
    id: 'first-screen-playlist',
    path: (ctx) =>
      `${hk(ctx)}/content/playlists?itemId=${id(ctx, 'playlists', 'Lobby welcome')}`,
    waitFor: '.playlist-preview',
    prepare: (page) => playPreview(page),
  },
  {
    id: 'first-screen-channel',
    path: (ctx) =>
      `${hk(ctx)}/channels?itemId=${id(ctx, 'channels', 'Harbor Front')}`,
    waitFor: DRAWER,
    async prepare(page) {
      await page.waitForSelector('::-p-text(Weekend brunch)');
      await scrollCalendarTo(page);
    },
    settle: 1500,
  },
  {
    id: 'first-screen-player',
    url: (ctx) => ctx.api,
    anonymous: true,
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    waitFor: '::-p-text(Your Registration Code)',
    settle: 2000,
  },
  {
    id: 'first-screen-register',
    path: (ctx) => `${hk(ctx)}/devices`,
    waitFor: 'table',
    async prepare(page) {
      await clickText(page, 'Add Device');
      await fill(page, `${MODAL} #name`, 'Lobby');
      await fill(page, `${MODAL} #pincode`, '7KQ3ZT8MPW');
    },
    selector: MODAL,
  },
  {
    id: 'first-screen-device-channels',
    path: (ctx) =>
      `${hk(ctx)}/devices?itemId=${id(ctx, 'devices', 'Downtown – Menu board')}`,
    players: true,
    waitFor: DRAWER,
    async prepare(page) {
      await page.waitForSelector(ONLINE);
      await clickText(page, 'Channels', `${DRAWER} button`);
    },
    settle: 1500,
  },

  // dashboard/media.md
  {
    id: 'media-library',
    path: (ctx) => `${hk(ctx)}/content/medias`,
    waitFor: 'table',
  },
  {
    id: 'media-details',
    path: (ctx) =>
      `${hk(ctx)}/content/medias?itemId=${id(ctx, 'media', 'Weekend brunch')}`,
    waitFor: DRAWER,
    settle: 1500,
  },

  // dashboard/playlists.md
  {
    id: 'playlists-create',
    path: (ctx) => `${hk(ctx)}/content/playlists`,
    waitFor: 'table',
    async prepare(page) {
      await clickText(page, 'Add Playlist');
      await fill(page, `${MODAL} input`, 'Breakfast menu');
    },
    selector: MODAL,
  },
  {
    id: 'playlists-editor',
    path: (ctx) =>
      `${hk(ctx)}/content/playlists?itemId=${id(ctx, 'playlists', 'Lunch menu')}`,
    waitFor: '.playlist-preview',
    prepare: (page) => playPreview(page),
  },
  {
    id: 'playlists-widget-settings',
    path: (ctx) =>
      `${hk(ctx)}/content/playlists?itemId=${id(ctx, 'playlists', 'Lunch menu')}`,
    waitFor: '.playlist-preview',
    async prepare(page) {
      const edit = await page.$$('[aria-label="Edit item"]');
      await edit[edit.length - 1].click();
      await page.waitForSelector(MODAL, { visible: true });
      await playDialogPreview(page);
    },
    settle: 2500,
  },
  // dashboard/channels.md
  {
    id: 'channels-create',
    path: (ctx) => `${hk(ctx)}/channels`,
    waitFor: 'table',
    async prepare(page) {
      await clickText(page, 'Add Channel');
      await fill(page, `${MODAL} input`, 'Airport lounge');
    },
    selector: MODAL,
  },
  {
    id: 'channels-editor',
    path: (ctx) =>
      `${hk(ctx)}/channels?itemId=${id(ctx, 'channels', 'Downtown')}`,
    waitFor: DRAWER,
    async prepare(page) {
      await page.waitForSelector('::-p-text(Weekend brunch)');
      await scrollCalendarTo(page, '07:00');
    },
    settle: 1500,
  },
  {
    id: 'channels-entry',
    path: (ctx) =>
      `${hk(ctx)}/channels?itemId=${id(ctx, 'channels', 'Downtown')}`,
    waitFor: DRAWER,
    async prepare(page) {
      // The header of an entry, which shows its times, opens the entry.
      const entry = await page.waitForSelector(
        '[class*="entry-header"]::-p-text(15:00-17:00)'
      );
      await entry.click();
    },
    selector: MODAL,
  },

  // dashboard/layouts.md
  {
    id: 'layouts-editor',
    path: (ctx) =>
      `${hk(ctx)}/content/layouts?itemId=${id(ctx, 'layouts', 'Menu board with sidebar')}`,
    waitFor: DRAWER,
    async prepare(page) {
      await clickText(page, 'Main', `${DRAWER} div`);
    },
    settle: 1200,
  },
  {
    id: 'layouts-widget',
    path: (ctx) =>
      `${hk(ctx)}/content/playlists?itemId=${id(ctx, 'playlists', 'Counter screen')}`,
    waitFor: '.playlist-preview',
    async prepare(page) {
      const edit = await page.waitForSelector('[aria-label="Edit item"]');
      await edit.click();
      await page.waitForSelector(MODAL, { visible: true });
      await playDialogPreview(page);
    },
    settle: 3000,
  },

  // dashboard/devices.md
  {
    id: 'devices-list',
    path: (ctx) => `${hk(ctx)}/devices`,
    players: true,
    waitFor: 'table',
  },
  // The browser player reports no telemetry, and the device's automation summaries
  // show playlist ids, so those tabs are not captured.
  ...['Overview', 'Preview', 'Events', 'Maintenance', 'Schedule'].map(
    (tab) => ({
      id: `devices-${tab.toLowerCase()}`,
      path: DEVICE,
      players: true,
      waitFor: DRAWER,
      async prepare(page) {
        await page.waitForSelector(ONLINE);
        await clickText(page, tab, `${DRAWER} button`);
      },
      settle: tab === 'Preview' ? 6000 : 2000,
    })
  ),

  // dashboard/widgets.md
  {
    id: 'widgets-list',
    path: (ctx) => `${hk(ctx)}/content/widgets`,
    waitFor: 'table',
  },
  {
    id: 'widgets-details',
    path: (ctx) => `${hk(ctx)}/content/widgets`,
    waitFor: 'table',
    async prepare(page) {
      await page.locator('button[aria-label="View Details QR Code"]').click();
      await page.waitForSelector(DRAWER, { visible: true });
    },
    settle: 1500,
  },
  {
    id: 'widgets-integrations',
    path: (ctx) => `${hk(ctx)}/content/widgets`,
    waitFor: 'table',
    async prepare(page) {
      await page
        .locator('button[aria-label="View Details Stock Ticker"]')
        .click();
      await page.waitForSelector(DRAWER, { visible: true });
      await clickText(page, 'Integrations', `${DRAWER} button`);
      await clickText(page, 'Finnhub', `${DRAWER} *`);
    },
    settle: 1500,
  },
  {
    id: 'widgets-upload',
    path: (ctx) => `${hk(ctx)}/content/widgets`,
    waitFor: 'table',
    prepare: (page) => clickText(page, 'Upload Widget'),
    selector: MODAL,
  },
  // dashboard/feeds.md
  {
    id: 'feeds-create',
    path: (ctx) => `${hk(ctx)}/feeds`,
    waitFor: 'table',
    async prepare(page) {
      await clickText(page, 'New feed');
      await fill(page, `${MODAL} input`, 'Daily menu');
    },
    selector: MODAL,
  },
  {
    id: 'feeds-entries',
    path: (ctx) => `${hk(ctx)}/feeds/${id(ctx, 'feeds', "Today's specials")}`,
    waitFor: '::-p-text(External ID)',
  },
  {
    id: 'feeds-connect',
    path: (ctx) => `${hk(ctx)}/feeds/${id(ctx, 'feeds', "Today's specials")}`,
    waitFor: '::-p-text(External ID)',
    prepare: (page) => clickText(page, 'Connect'),
    settle: 1500,
  },

  // dashboard/automations.md
  {
    id: 'automations-list',
    path: (ctx) => `${hk(ctx)}/automations`,
    waitFor: 'table',
  },
  {
    id: 'automations-editor',
    path: (ctx) => `${hk(ctx)}/automations`,
    waitFor: 'table',
    async prepare(page) {
      await clickText(page, 'Happy hour on Fridays', 'td');
    },
    settle: 2000,
  },

  // dashboard/teams.md
  {
    id: 'teams-members',
    path: (ctx) => `${hk(ctx)}/teams?itemId=${id(ctx, 'teams', 'Marketing')}`,
    waitFor: DRAWER,
    settle: 2000,
  },
  {
    // Resources belong to a team when they are created with the team selected.
    id: 'teams-resources',
    path: (ctx) => `${hk(ctx)}/content/playlists`,
    waitFor: 'table',
    async prepare(page) {
      await chooseFilter(page, 0, ['Marketing']);
      await page.keyboard.press('Escape');
    },
    settle: 1500,
  },

  // dashboard/tags.md
  {
    id: 'tags-management',
    path: (ctx) => `${hk(ctx)}/tags`,
    waitFor: '::-p-text(Location)',
  },
  {
    id: 'tags-filter',
    path: (ctx) => `${hk(ctx)}/content/medias`,
    waitFor: 'table',
    prepare: (page) => chooseFilter(page, 1, ['Lunch', 'Seasonal']),
    settle: 1500,
  },
  {
    id: 'tags-tree',
    path: (ctx) => `${hk(ctx)}/content/medias`,
    waitFor: 'table',
    async prepare(page) {
      await page.locator('[aria-label*="tree" i], [title*="tree" i]').click();
    },
    settle: 1500,
  },

  // dashboard/usage-and-quotas.md
  {
    id: 'usage',
    path: (ctx) => `${hk(ctx)}/usage`,
    waitFor: '::-p-text(Storage)',
  },

  // dashboard/ai-agents.md
  { id: 'agents-list', path: (ctx) => `${hk(ctx)}/agents`, waitFor: 'table' },
  {
    id: 'agents-activity',
    path: (ctx) => `${hk(ctx)}/agents`,
    waitFor: 'table',
    prepare: (page) => clickText(page, 'Activity log'),
    settle: 1500,
  },
  {
    id: 'agents-setup',
    path: (ctx) => `${hk(ctx)}/agents`,
    waitFor: 'table',
    prepare: (page) => clickText(page, 'Setup instructions'),
    settle: 1500,
  },

  // dashboard/notifications.md
  {
    id: 'notifications-panel',
    path: (ctx) => `${hk(ctx)}/content/playlists`,
    waitFor: 'table',
    async prepare(page) {
      await page.locator('.notification-bell').click();
    },
    settle: 1500,
  },

  // dashboard/settings.md and getting-started/first-login.md
  {
    id: 'settings-profile',
    path: () => '/settings',
    waitFor: '::-p-text(Profile Information)',
  },
  {
    id: 'settings-passkeys',
    path: () => '/settings',
    waitFor: '::-p-text(Your Passkeys)',
    async prepare(page) {
      await page.evaluate(() =>
        [...document.querySelectorAll('h2, h3, h4')]
          .find((heading) => heading.textContent.includes('Security'))
          ?.scrollIntoView({ block: 'start' })
      );
    },
  },
  {
    id: 'login',
    path: () => '/login',
    anonymous: true,
    waitFor: '::-p-text(Login with Passkey)',
  },

  // concepts/users-and-teams.md
  {
    id: 'organization-members',
    path: (ctx) => `${hk(ctx)}/organization`,
    waitFor: 'table',
  },
  {
    id: 'organization-invite',
    path: (ctx) => `${hk(ctx)}/organization`,
    waitFor: 'table',
    async prepare(page) {
      await clickText(page, 'Invite Member');
      await fill(page, `${MODAL} #email`, 'lena.berg@example.com');
    },
    selector: MODAL,
  },
  // administration/network-administration.md
  {
    id: 'network-overview',
    path: () => '/network',
    waitFor: '::-p-text(Network Information)',
  },
  { id: 'network-settings', path: () => '/network/settings', waitFor: 'input' },
  {
    id: 'network-organizations',
    path: () => '/network/organizations',
    waitFor: 'table',
  },
  { id: 'network-users', path: () => '/network/users', waitFor: 'table' },
  {
    id: 'network-widget-access',
    path: () => '/network/widgets',
    waitFor: '[role="option"]',
    async prepare(page) {
      await clickText(page, 'Weather', '[role="option"]');
      await page.waitForSelector('::-p-text(Who can use this widget)');
    },
    settle: 1500,
  },
  {
    id: 'network-widget-package',
    path: () => '/network/widgets',
    waitFor: '[role="option"]',
    async prepare(page) {
      await clickText(page, 'Welcome banner', '[role="option"]');
      await page.waitForSelector('::-p-text(Version 1)');
    },
    settle: 1500,
  },

  // administration/admin-tool.md
  {
    id: 'admin-tool-sign-in',
    url: (ctx) => `${ctx.api}/admin/login`,
    anonymous: true,
    waitFor: '::-p-text(Welcome to Castmill Admin)',
  },

  // players/on-screen-menu-and-debugging.md. The offline demo device plays here,
  // so it does not compete with the players that keep the others online.
  {
    id: 'player-menu',
    url: (ctx) => ctx.api,
    anonymous: true,
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 2 },
    // The menu opens in the top-left corner.
    clip: { x: 0, y: 0, width: 960, height: 540 },
    storage: () => ({ machineId: hardwareId('harbor-front-counter') }),
    kiosk: true,
    timeout: 120_000,
    async prepare(page) {
      await waitForSlide(page);
      await page.keyboard.press('ArrowDown');
    },
    settle: 1000,
  },
  {
    id: 'player-debug-overlay',
    url: (ctx) => `${ctx.api}/?debugOverlay=1`,
    anonymous: true,
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 2 },
    // The overlay of the playlist is in its top-right corner.
    clip: { x: 960, y: 0, width: 960, height: 540 },
    storage: () => ({ machineId: hardwareId('harbor-front-counter') }),
    kiosk: true,
    timeout: 120_000,
    prepare: (page) => waitForSlide(page),
    settle: 1500,
  },
];
