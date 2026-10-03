/**
 * Device bootstrapping.
 *
 * (c) 2011-2024 Castmill AB All Rights Reserved.
 *
 */
import { StorageBrowser } from '@castmill/cache';
import { mountDevice, Device, BrowserMachine } from '@castmill/device';
import { enableDebugOverlayFromEnv } from '@castmill/player';

// Inlined by esbuild from the VITE_DEBUG_OVERLAY environment variable, see
// config/config.exs.
enableDebugOverlayFromEnv(import.meta.env.VITE_DEBUG_OVERLAY);

(async () => {
  const browserMachine = new BrowserMachine();
  // The worker lives in /assets/ but must control the player page at "/".
  // The endpoint allows this scope with a Service-Worker-Allowed header.
  const browserCache = new StorageBrowser(
    'browser-cache',
    '/assets/',
    true,
    '/'
  );
  const device = new Device(browserMachine, browserCache);

  await device.init();
  await browserCache.init();

  mountDevice(document.getElementById('device'), device);
})();
