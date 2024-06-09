import { type Component, onMount } from 'solid-js';
import { mountDevice, Device } from '@castmill/device';
import { WebosMachine, FileStorage } from '../classes';

export const PlayerFrame: Component = () => {
  let ref;

  onMount(async () => {
    console.log('zak init1');
    const webosMachine = new WebosMachine();
    const cache = new FileStorage('file-cache');
    const device = new Device(webosMachine, cache);

    console.log('zak init2');
    await cache.init();
    console.log('zak init3', ref, device);
    mountDevice(ref, device);
    console.log('zak init4');
  });

  return <div class="player-frame" ref={ref} />;
};
