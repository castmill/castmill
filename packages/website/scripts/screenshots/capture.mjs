// Captures the documentation screenshots from a running demo dashboard, in light
// and dark mode, into static/img/screenshots/<id>-<theme>.webp.
//
//     node scripts/screenshots/capture.mjs            # every shot
//     node scripts/screenshots/capture.mjs media-library playlists-editor
//
// See README.md in this folder for the demo setup it needs.
import { mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { KIOSK_USER_AGENT, launchBrowser, startPlayers } from './players.mjs';
import { shots } from './shots.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../static/img/screenshots');
const DASHBOARD = process.env.DASHBOARD_URL ?? 'http://localhost:3000';
const API = process.env.CASTMILL_API_URL ?? 'http://localhost:4000';
const THEMES = ['light', 'dark'];
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2 };
// Full-page captures are scaled to this width; element captures are never larger.
const MAX_WIDTH = 1600;

// Captures must not show transitions, blinking carets or scrollbars.
const STILL_CSS = `
  *, *::before, *::after { transition: none !important; animation-duration: 0s !important;
    animation-delay: 0s !important; caret-color: transparent !important; }
  ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
`;

const demo = JSON.parse(readFileSync(path.join(here, '.demo.json'), 'utf8'));
const selected = process.argv.slice(2);
const todo = selected.length
  ? shots.filter((shot) => selected.includes(shot.id))
  : shots;
const unknown = selected.filter((id) => !shots.some((shot) => shot.id === id));
if (unknown.length) throw new Error(`Unknown shots: ${unknown.join(', ')}`);

const ctx = {
  demo,
  api: API,
  dashboard: DASHBOARD,
  org: (name = 'Harbor Kitchen') => demo.organizations[name],
  seed: demo.seed ?? {},
};

/** Calls the dashboard API as a demo user. */
ctx.request = async (method, url, body, user = 'alex') => {
  const init = {
    method,
    headers: {
      Authorization: `Bearer ${demo.tokens[user]}`,
      // Network administration endpoints resolve the network from the origin.
      Origin: DASHBOARD,
    },
  };
  if (body) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${API}${url}`, init);
  if (!response.ok) throw new Error(`${method} ${url}: ${response.status}`);
  return response.status === 204 ? null : response.json().catch(() => null);
};

async function openPage(context, shot, theme) {
  const page = await context.newPage();
  await page.setViewport({ ...VIEWPORT, ...shot.viewport });
  // The demo restaurants are in Sweden; dates and times read as local times there.
  await page.emulateTimezone('Europe/Stockholm');
  if (shot.kiosk) {
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setUserAgentOverride', {
      userAgent: KIOSK_USER_AGENT,
      platform: 'Linux x86_64',
    });
  }
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: theme },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);
  const token = shot.user
    ? demo.tokens[shot.user]
    : shot.anonymous
      ? null
      : demo.tokens.alex;
  await page.evaluateOnNewDocument(
    (token, theme, css, storage) => {
      if (token) localStorage.setItem('castmill_auth_token', token);
      else localStorage.removeItem('castmill_auth_token');
      for (const [key, value] of Object.entries(storage))
        localStorage.setItem(key, value);
      localStorage.setItem('castmill_theme', theme);
      // Headless Chrome has no platform authenticator; the login page needs one.
      if (window.PublicKeyCredential) {
        PublicKeyCredential.isConditionalMediationAvailable = async () => true;
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable =
          async () => true;
      }
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
      });
    },
    token,
    theme,
    STILL_CSS,
    shot.storage ? shot.storage(ctx) : {}
  );
  return page;
}

const DEBUG = Boolean(process.env.CAPTURE_DEBUG);

async function capture(context, shot, theme) {
  const started = Date.now();
  const step = (name) =>
    DEBUG && console.log(`    ${name} at ${Date.now() - started} ms`);
  const page = await openPage(context, shot, theme);
  try {
    const url = shot.url ? shot.url(ctx) : `${DASHBOARD}${shot.path(ctx)}`;
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    step('loaded');
    // Players and the dashboard keep sockets open, so wait for quiet, not idle.
    await page
      .waitForNetworkIdle({ idleTime: 600, timeout: 15_000 })
      .catch(() => {});
    if (shot.waitFor)
      await page.waitForSelector(shot.waitFor, {
        visible: true,
        timeout: 30_000,
      });
    step('ready');
    if (shot.prepare) await shot.prepare(page, ctx, theme);
    step('prepared');
    await page.bringToFront();
    await page.evaluate(() => document.fonts.ready);
    step('fonts');
    await new Promise((resolve) => setTimeout(resolve, shot.settle ?? 800));

    let png;
    if (shot.selector) {
      // Include some of the page around the element, so dialogs keep their
      // rounded corners and shadow.
      const element = await page.waitForSelector(shot.selector, {
        visible: true,
      });
      const box = await element.boundingBox();
      const viewport = page.viewport();
      const padding = shot.padding ?? 24;
      const x = Math.max(0, box.x - padding);
      const y = Math.max(0, box.y - padding);
      png = await page.screenshot({
        type: 'png',
        clip: {
          x,
          y,
          width: Math.min(viewport.width - x, box.width + 2 * padding),
          height: Math.min(viewport.height - y, box.height + 2 * padding),
        },
      });
    } else {
      png = await page.screenshot({ type: 'png', clip: shot.clip });
    }

    const file = path.join(OUT, `${shot.id}-${theme}.webp`);
    const image = sharp(png);
    const { width } = await image.metadata();
    await image
      .resize({ width: Math.min(width, MAX_WIDTH), withoutEnlargement: true })
      .webp({ quality: 82, effort: 6 })
      .toFile(file);
    console.log(
      `  ${path.relative(process.cwd(), file)} (${((Date.now() - started) / 1000).toFixed(1)} s)`
    );
  } catch (error) {
    const debug = path.join(os.tmpdir(), `capture-${shot.id}-${theme}.png`);
    await page.screenshot({ path: debug }).catch(() => {});
    console.error(`  failed at ${page.url()}; see ${debug}`);
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

mkdirSync(OUT, { recursive: true });

// The demo players run in the same browser as the captures. Chrome occasionally
// drops the connection while videos play, so the browser is restarted when needed.
const session = { browser: null, players: [] };
const needsPlayers = todo.some((shot) => shot.players);

async function startBrowser() {
  await stopBrowser();
  session.browser = await launchBrowser({
    args: [
      '--hide-scrollbars',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });
  if (needsPlayers) {
    session.players = await startPlayers(session.browser, {
      waitForOnline: { token: demo.tokens.alex, organizationId: ctx.org() },
    });
  }
}

async function stopBrowser() {
  await Promise.all(
    session.players.map((player) => player.close?.().catch(() => {}))
  );
  session.players = [];
  await session.browser?.close().catch(() => {});
}

/**
 * Captures one theme of a shot with a time limit, and tries once more on failure.
 * Every attempt gets its own browser context, so connections that a previous page
 * left open cannot stall it.
 */
async function captureWithRetry(shot, theme, limit = shot.timeout ?? 45_000) {
  for (let attempt = 1; ; attempt++) {
    let timer;
    const context = await session.browser.createBrowserContext();
    const run = capture(context, shot, theme);
    run.catch(() => {}); // An attempt that timed out fails later; it is handled below.
    try {
      return await Promise.race([
        run,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`No capture after ${limit / 1000} s`)),
            limit
          );
        }),
      ]);
    } catch (error) {
      if (attempt >= 2) throw error;
      console.warn(`  retrying: ${error.message}`);
    } finally {
      clearTimeout(timer);
      await context.close().catch(() => {});
      if (!session.browser.connected) await startBrowser();
    }
  }
}

try {
  await startBrowser();
  for (const shot of todo) {
    console.log(shot.id);
    if (shot.setup) await shot.setup(ctx);
    for (const theme of THEMES) await captureWithRetry(shot, theme);
    if (shot.teardown) await shot.teardown(ctx);
  }
} finally {
  await stopBrowser();
}
