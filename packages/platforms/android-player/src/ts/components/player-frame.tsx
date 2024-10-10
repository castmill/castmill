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

    // Android Emulator uses 10.0.2.2 to refer to the host machine
    // TODO: Make this configurable somehow to support different player backends
    const device = new Device(androidMachine, cache, {
      baseUrl: 'http://10.0.2.2:4000',
    });

    await cache.init();
    mountDevice(ref, device);
  });

  return <div class="player-frame" ref={ref!} />;
};
