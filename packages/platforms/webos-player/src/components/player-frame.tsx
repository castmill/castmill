import { type Component, onCleanup, onMount } from 'solid-js';
import { mountDevice, Device } from '@castmill/device';
import { enableDebugOverlayFromEnv } from '@castmill/player';
import { MemoryCache } from '@castmill/cache';
import { WebosMachine, FileStorage, startDisplayMaintenance } from '../classes';
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
    void (async () => {
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
      startupStep = 'device mount';
      if (!ref) throw new Error('Player mount element is unavailable');
      mountDevice(ref, device);
      if (startup) startup.style.display = 'none';
      resetStartupRetry();
    })().catch((error: unknown) => {
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
      <div class="player-frame" ref={ref!} />
      <div class="webos-startup" ref={startup!} role="status">
        <div class="webos-startup__track">
          <div />
        </div>
      </div>
    </>
  );
};
