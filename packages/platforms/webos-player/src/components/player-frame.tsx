import { type Component, onCleanup, onMount } from 'solid-js';
import { mountDevice, Device } from '@castmill/device';
import { enableDebugOverlayFromEnv } from '@castmill/player';
import { MemoryCache } from '@castmill/cache';
import { WebosMachine, FileStorage } from '../classes';
import { createWebosVideoPlayback, WebosWebSocket } from '../shared';

export const PlayerFrame: Component = () => {
  let ref: HTMLDivElement | undefined;
  let startup: HTMLDivElement | undefined;

  onMount(() => {
    enableDebugOverlayFromEnv(import.meta.env.VITE_DEBUG_OVERLAY);
    let device: Device | undefined;
    let startupStep = 'device construction';
    const showStartupError = (error: unknown) => {
      startup!.style.display = 'flex';
      startup!.setAttribute('role', 'alert');
      startup!.textContent =
        error instanceof Error ? error.message : String(error);
    };
    onCleanup(() => device?.off('startup-error', showStartupError));
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
      mountDevice(ref!, device);
      startup!.style.display = 'none';
    })().catch((error: unknown) => {
      device?.reportStartupError(error);
      console.error(
        `WebOS player initialization failed during ${startupStep}`,
        error
      );
      showStartupError(error);
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
