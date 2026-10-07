import { type Component, onMount } from 'solid-js';
import { mountDevice, Device } from '@castmill/device';
import { enableDebugOverlayFromEnv } from '@castmill/player';
import { WebosMachine, FileStorage } from '../classes';

export const PlayerFrame: Component = () => {
  let ref: HTMLDivElement | undefined;

  onMount(async () => {
    if (!ref) {
      return;
    }

    enableDebugOverlayFromEnv(import.meta.env.VITE_DEBUG_OVERLAY);

    const webosMachine = new WebosMachine();
    const cache = new FileStorage('file-cache');
    const device = new Device(webosMachine, cache);

    await device.init();
    await cache.init();

    mountDevice(ref, device);
  });

  return <div class="player-frame" ref={ref!} />;
};
