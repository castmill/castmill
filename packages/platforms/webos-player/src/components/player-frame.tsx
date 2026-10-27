import { type Component, onCleanup, onMount } from 'solid-js';
import { mountDevice, Device } from '@castmill/device';
import { enableDebugOverlayFromEnv } from '@castmill/player';
import { MemoryCache } from '@castmill/cache';
import {
  WebosMachine,
  FileStorage,
  startDisplayMaintenance,
  startStallWatchdog,
  STARTUP_TIMEOUT_MS,
} from '../classes';
import { resetStartupRetry, scheduleStartupRetry } from '../boot/startup-retry';
import { createWebosVideoPlayback, WebosWebSocket } from '../shared';

export const PlayerFrame: Component = () => {
  let ref: HTMLDivElement | undefined;
  let startup: HTMLDivElement | undefined;

  onMount(() => {
    enableDebugOverlayFromEnv(import.meta.env.VITE_DEBUG_OVERLAY);
    let device: Device | undefined;
    let startupStep = 'device construction';
    const showStartupError = (error: unknown) => {
      if (!startup) return;
      startup.style.display = 'flex';
      startup.setAttribute('role', 'alert');
      startup.textContent =
        error instanceof Error ? error.message : String(error);
    };
    onCleanup(() => device?.off('startup-error', showStartupError));
    onCleanup(startDisplayMaintenance());
    onCleanup(
      startStallWatchdog({
        onStall: (stalledMs) => {
          const error = new Error(
            `WebOS player main thread stalled for ${Math.round(stalledMs / 1000)} s; reloading`
          );
          console.error(error.message);
          device?.getPlayerGlobals?.().reportError?.({
            category: 'runtime',
            error,
          });
          window.location.reload();
        },
      })
    );
    // SCAP calls during startup can hang without failing; treat that like a
    // startup failure so the retry back-off reloads the app.
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    const startupTimeout = new Promise<never>((_, reject) => {
      startupTimer = setTimeout(
        () =>
          reject(
            new Error(`WebOS player startup timed out during ${startupStep}`)
          ),
        STARTUP_TIMEOUT_MS
      );
    });
    onCleanup(() => clearTimeout(startupTimer));
    let abandoned = false;
    const start = (async () => {
      const storage = new FileStorage();
      const cacheBackend = new MemoryCache(storage);
      device = new Device(new WebosMachine(), storage, {
        transport: WebosWebSocket,
        createVideoPlaybackController: createWebosVideoPlayback,
        cacheBackend,
      });
      device.on('startup-error', showStartupError);
      startupStep = 'device configuration';
      await device.init();
      storage.setServerOrigin(await device.getBaseUrl());
      startupStep = 'cache initialization';
      await cacheBackend.init();
      if (abandoned) return;
      startupStep = 'device mount';
      if (!ref) throw new Error('Player mount element is unavailable');
      mountDevice(ref, device);
      if (startup) startup.style.display = 'none';
      resetStartupRetry();
    })();
    void Promise.race([start, startupTimeout])
      .then(() => clearTimeout(startupTimer))
      .catch((error: unknown) => {
        abandoned = true;
        clearTimeout(startupTimer);
        device?.reportStartupError(error);
        console.error(
          `WebOS player initialization failed during ${startupStep}`,
          error
        );
        showStartupError(error);
        scheduleStartupRetry();
      });
  });

  return (
    <>
      <div class="player-frame" ref={(el) => (ref = el)} />
      <div class="webos-startup" ref={(el) => (startup = el)} role="status">
        <div class="webos-startup__track">
          <div />
        </div>
      </div>
    </>
  );
};
