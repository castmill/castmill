/**
 * Device bootstrapping.
 *
 * (c) 2011-2024 Castmill AB All Rights Reserved.
 *
 */
import { StorageBrowser } from '@castmill/cache';
import {
  mountDevice,
  Device,
  BrowserMachine,
  CastmillOSMachine,
  getCastmillOSBridge,
} from '@castmill/device';
import { enableDebugOverlayFromEnv } from '@castmill/player';

// Inlined by esbuild from the VITE_DEBUG_OVERLAY environment variable, see
// config/config.exs. The optional chain keeps the player booting if a build
// runs without that define, since esbuild then compiles `import.meta` to `{}`.
enableDebugOverlayFromEnv(import.meta.env?.VITE_DEBUG_OVERLAY);

(async () => {
  // Inside the Castmill OS kiosk shell the device talks to the OS through
  // its native bridge; in any other browser it is a plain web player.
  const castmillOS = getCastmillOSBridge();
  const machine = castmillOS
    ? new CastmillOSMachine(castmillOS)
    : new BrowserMachine();
  // The worker lives in /assets/ but must control the player page at "/".
  // The endpoint allows this scope with a Service-Worker-Allowed header.
  const browserCache = new StorageBrowser(
    'browser-cache',
    '/assets/',
    true,
    '/'
  );
  const device = new Device(machine, browserCache);

  await device.init();
  await browserCache.init();

  mountDevice(document.getElementById('device'), device);
})();
