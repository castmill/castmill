// Runs Castmill browser players (the player served at http://localhost:4000/)
// in Puppeteer for the screenshot demo.
//
// The browser player identifies itself by the `machineId` in localStorage.
// Every demo device gets a hardware id derived from its slug, so it is the
// same device on every run: a player that starts without credentials asks the
// server to register, and the server recovers the existing device by its
// hardware id and gives the player a new token.
//
// Bring the online demo players up and keep them running until Ctrl+C:
//
//     node scripts/screenshots/players.mjs
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

export const PLAYER_URL =
  process.env.CASTMILL_PLAYER_URL ?? 'http://localhost:4000/';

const DEFAULT_TIMEOUT = 60_000;

export const KIOSK_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

/** The demo devices of Harbor Kitchen. The last one is meant to stay offline. */
export const DEMO_PLAYERS = [
  {
    slug: 'downtown-menu-board',
    name: 'Downtown – Menu board',
    online: true,
    location: { latitude: 57.7072, longitude: 11.9668 },
  },
  {
    slug: 'downtown-window',
    name: 'Downtown – Window',
    online: true,
    location: { latitude: 57.7075, longitude: 11.9672 },
  },
  {
    slug: 'airport-gate-12',
    name: 'Airport – Gate 12',
    online: true,
    location: { latitude: 57.6628, longitude: 12.2798 },
  },
  {
    slug: 'harbor-front-counter',
    name: 'Harbor Front – Counter',
    online: false,
    location: { latitude: 57.7046, longitude: 11.944 },
  },
];

/** Browser flags that let players autoplay video without a user gesture. */
export const PLAYER_BROWSER_ARGS = [
  '--autoplay-policy=no-user-gesture-required',
];

export function launchBrowser(opts = {}) {
  return puppeteer.launch({
    headless: true,
    ...opts,
    args: [...PLAYER_BROWSER_ARGS, ...(opts.args ?? [])],
  });
}

/** A stable, UUID-formatted hardware id for a demo device. */
export function hardwareId(slug) {
  const h = createHash('sha256')
    .update(`castmill-demo-player:${slug}`)
    .digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Device credentials stored by the player, or null. Survives page reloads. */
async function readCredentials(page) {
  try {
    const credentials = await page.evaluate(() =>
      localStorage.getItem('castmill.credentials')
    );
    return credentials ? JSON.parse(credentials) : null;
  } catch {
    return null; // The player is reloading.
  }
}

async function waitForCredentials(page, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const credentials = await readCredentials(page);
    if (credentials) return credentials;
    await sleep(500);
  }
  return null;
}

const isRegistrationResponse = (response) =>
  response.request().method() === 'POST' &&
  new URL(response.url()).pathname.replace(/\/$/, '') === '/registrations';

/**
 * Opens a player in a new browser context and resolves when it has asked the
 * server to register: { session, status, pincode }. Status 200 means the
 * server recovered an existing device, 201 that the player shows `pincode`.
 */
async function openPlayer(browser, device, opts) {
  const baseUrl = opts.baseUrl ?? PLAYER_URL;
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  const session = { context, page, errors, close: () => context.close() };

  try {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.setViewport(opts.viewport ?? { width: 1280, height: 720 });
    await page.emulateTimezone(opts.timezone ?? 'Europe/Stockholm');
    // Report a Chrome kiosk on Linux rather than headless Chrome on the host.
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setUserAgentOverride', {
      userAgent: KIOSK_USER_AGENT,
      platform: 'Linux x86_64',
    });

    if (device) {
      await page.evaluateOnNewDocument((id) => {
        try {
          localStorage.setItem('machineId', id);
        } catch {
          // Documents without storage access, e.g. about:blank.
        }
      }, hardwareId(device.slug));
      if (device.location) {
        await context.overridePermissions(new URL(baseUrl).origin, [
          'geolocation',
        ]);
        await page.setGeolocation(device.location);
      }
    }

    const [response] = await Promise.all([
      page.waitForResponse(isRegistrationResponse, { timeout }),
      page.goto(baseUrl),
    ]);
    const status = response.status();
    if (status !== 200 && status !== 201) {
      throw new Error(`Registration request failed with HTTP ${status}`);
    }

    let pincode = null;
    if (status === 201) {
      ({ pincode } = (await response.json()).data);
      // The player joins its registration channel before it shows the code.
      await page.waitForFunction(
        (code) => document.body.innerText.includes(code),
        { timeout },
        pincode
      );
    }
    return { session, status, pincode };
  } catch (error) {
    await context.close();
    throw error;
  }
}

function playerHandle(device, session, credentials) {
  return {
    slug: device.slug,
    name: device.name,
    deviceId: credentials.device.id,
    ...session,
  };
}

/**
 * Starts demo devices, by default the online ones of DEMO_PLAYERS, each in its
 * own context of `browser`, and resolves once all of them are logged in. With
 * `opts.waitForOnline = { token, organizationId }` it also waits until the
 * dashboard API lists them as online.
 *
 * Options: baseUrl, viewport, timezone, timeout, waitForOnline.
 * Resolves to [{ slug, name, deviceId, page, context, errors, close() }].
 */
export async function startPlayers(browser, devices, opts = {}) {
  if (!Array.isArray(devices)) {
    opts = devices ?? {};
    devices = DEMO_PLAYERS.filter((device) => device.online);
  }
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;

  const results = await Promise.allSettled(
    devices.map(async (device) => {
      const { session, status } = await openPlayer(browser, device, opts);
      const credentials =
        status === 200 && (await waitForCredentials(session.page, timeout));
      if (!credentials) {
        await session.close();
        throw new Error(
          `${device.name} is not registered. Run seed.mjs first.`
        );
      }
      return playerHandle(device, session, credentials);
    })
  );
  const players = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
  const failure = results.find((r) => r.status === 'rejected');

  try {
    if (failure) throw failure.reason;
    if (opts.waitForOnline) {
      await waitUntilOnline(
        players.map((player) => player.deviceId),
        opts.waitForOnline,
        timeout
      );
    }
  } catch (error) {
    await stopPlayers(players);
    throw error;
  }
  return players;
}

export async function stopPlayers(players) {
  await Promise.all(players.map((player) => player.close()));
}

/** Polls the dashboard API until all the given devices are online. */
export async function waitUntilOnline(
  deviceIds,
  { token, organizationId, apiUrl },
  timeout = DEFAULT_TIMEOUT
) {
  const url = `${apiUrl ?? new URL(PLAYER_URL).origin}/dashboard/organizations/${organizationId}/devices?page=1&page_size=100`;
  const deadline = Date.now() + timeout;
  let offline = deviceIds;

  while (Date.now() < deadline) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const { data } = await response.json();
      const online = new Set(
        data.filter((device) => device.online).map((device) => device.id)
      );
      offline = deviceIds.filter((id) => !online.has(id));
      if (offline.length === 0) return;
    }
    await sleep(1000);
  }
  throw new Error(
    `Devices not online after ${timeout} ms: ${offline.join(', ')}`
  );
}

/**
 * Starts a demo device with its stable hardware id. If the player shows a
 * registration code, calls `register(pincode)` (e.g. POST
 * /dashboard/organizations/:id/devices) and waits until the player has its
 * credentials. Resolves to { player, pincode, recovered }; `recovered` is true
 * when the server already knew the device and no registration was needed.
 */
export async function registerPlayer(browser, device, register, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const { session, status, pincode } = await openPlayer(browser, device, opts);

  try {
    if (status === 201) {
      await register(pincode);
      // A player that misses the registration event recovers its device by
      // hardware id after a reload.
      if (!(await waitForCredentials(session.page, 15_000)))
        await session.page.reload();
    }
    const credentials = await waitForCredentials(session.page, timeout);
    if (!credentials)
      throw new Error(`${device.name} did not receive its credentials`);
    return {
      player: playerHandle(device, session, credentials),
      pincode,
      recovered: status === 200,
    };
  } catch (error) {
    await session.close();
    throw error;
  }
}

/**
 * Opens a new, unregistered player (random hardware id) and resolves to
 * { pincode, page, context, errors, close() } once it shows its registration
 * code, e.g. for the "register a device" screenshots.
 */
export async function startNewPlayer(browser, opts = {}) {
  const { session, status, pincode } = await openPlayer(browser, null, opts);
  if (status !== 201) {
    await session.close();
    throw new Error('The new player was not offered a registration code');
  }
  return { pincode, ...session };
}

async function main() {
  const demo = JSON.parse(
    readFileSync(path.join(import.meta.dirname, '.demo.json'), 'utf8')
  );
  const browser = await launchBrowser();
  const shutdown = async () => {
    await browser.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    const players = await startPlayers(
      browser,
      DEMO_PLAYERS.filter((device) => device.online),
      {
        waitForOnline: {
          token: demo.tokens.alex,
          organizationId: demo.organizations['Harbor Kitchen'],
        },
      }
    );
    console.log(
      `Online: ${players.map((player) => player.name).join(', ')}. Press Ctrl+C to stop.`
    );
  } catch (error) {
    await browser.close();
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
