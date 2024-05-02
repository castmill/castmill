import { type Component, onMount } from 'solid-js';
import { mountDevice, Device } from '@castmill/device';
import { ElectronMachine, FileStorage } from '../classes';

const PlayerFrame: Component = () => {
  let ref;

  onMount(async () => {
    const electronMachine = new ElectronMachine();
    const cache = new FileStorage('file-cache');
    const device = new Device(electronMachine, cache);

    await cache.init();
    mountDevice(ref, device);
  });

  return <div class="player-frame" ref={ref} />;
};

export default PlayerFrame;
