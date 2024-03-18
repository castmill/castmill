import { type Component, onMount } from 'solid-js';
import {
  StorageIntegration,
  StoreResult,
  StorageBrowser,
} from '@castmill/cache';
import { mountDevice, Device } from '@castmill/device';
import { ElectronMachine } from '../classes';

const storage: StorageIntegration = {
  init: () => Promise.resolve(),
  info: () =>
    Promise.resolve({
      used: 0,
      total: 0,
      free: 0,
    }),
  listFiles: () => Promise.resolve([]),
  storeFile: (
    url: string
    // data?: any
  ) =>
    Promise.resolve({
      result: { code: StoreResult.Success },
      item: { url, size: 1 },
    }),
  retrieveFile: (url: string) => Promise.resolve(url),
  deleteFile: (_url: string) => Promise.resolve(),
  deleteAllFiles: () => Promise.resolve(),
  close: () => Promise.resolve(),
};

const PlayerFrame: Component = () => {
  let ref;

  onMount(async () => {
    const electronMachine = new ElectronMachine();
    const browserCache = new StorageBrowser('browser-cache', '/assets/');
    const device = new Device(electronMachine, storage);

    await browserCache.init();
    mountDevice(ref, device);
  });

  return <div class="player-frame" ref={ref} />;
};

export default PlayerFrame;
