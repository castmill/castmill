import { type Component, onMount } from 'solid-js';
import { mountDevice, Device } from '@castmill/device';
import { AndroidMachine, AndroidStorage } from '../classes';

export const PlayerFrame: Component = () => {
  let ref: HTMLDivElement | undefined;

  onMount(async () => {
    if (!ref) {
      return;
    }

    const androidMachine = new AndroidMachine();
    const cache = new AndroidStorage('file-cache');
    const device = new Device(androidMachine, cache);

    //TODO: perform initial setup once
    await cache.init();
    mountDevice(ref, device);
  });

  return <div class="player-frame" ref={ref!} />;
};
