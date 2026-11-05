import { type Component, onMount } from 'solid-js';
import { mountDevice, Device } from '@castmill/device';
import { enableDebugOverlayFromEnv } from '@castmill/player';
import { AndroidMachine, AndroidStorage } from '../classes';

export const PlayerFrame: Component = () => {
  let ref: HTMLDivElement | undefined;

  onMount(async () => {
    if (!ref) {
      return;
    }

    enableDebugOverlayFromEnv(import.meta.env.VITE_DEBUG_OVERLAY);

    const androidMachine = new AndroidMachine();
    const cache = new AndroidStorage('file-cache');
    const device = new Device(androidMachine, cache);

    await device.init();
    await cache.init();

    mountDevice(ref, device);
  });

  return <div class="player-frame" ref={ref!} />;
};
