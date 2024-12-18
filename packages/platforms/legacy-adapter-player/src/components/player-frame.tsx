import { type Component, onMount } from 'solid-js';
import { mountDevice, Device, Machine, BrowserMachine } from '@castmill/device';
import { StorageIntegration, StorageBrowser } from '@castmill/cache';
import {
  AndroidLegacyMachine,
  ElectronLegacyMachine,
  AndroidLegacyFileStorage,
  LegacyMachine,
} from '../classes';

type LegacyPlatform = 'webos' | 'android' | 'electron' | 'browser';
const getLegacyPlatform = (): LegacyPlatform => {
  const userAgent = navigator.userAgent;

  if (userAgent.includes('Web0S')) {
    return 'webos';
  }

  if (userAgent.includes('Android')) {
    return 'android';
  }

  if (userAgent.includes('Electron')) {
    return 'electron';
  }

  return 'browser';
};

const getLegacyMachine = (platform: LegacyPlatform): LegacyMachine => {
  switch (platform) {
    //TODO Investigate if we need to support webos
    case 'webos':
      return new BrowserMachine();
    case 'android':
      return new AndroidLegacyMachine();
    case 'electron':
      return new ElectronLegacyMachine();
    case 'browser':
      return new BrowserMachine();
  }
};

const getLegacyStorage = (platform: LegacyPlatform): StorageIntegration => {
  switch (platform) {
    // TODO: Investigate if we need to support webos
    case 'webos':
      return new StorageBrowser('file-cache');
    case 'android':
      // TODO: Check if storagebrowser works on our Android hardware
      // return new StorageBrowser(); // Doesn't work when running non-https. Check if it works on prod endpoint
      return new AndroidLegacyFileStorage('');
    case 'electron':
      // Legacy electron player doesn't provide any APIs downloading files so
      // we use the browser storage implementation.
      return new StorageBrowser('file-cache');
    case 'browser':
      return new StorageBrowser('file-cache');
  }
};

export const PlayerFrame: Component = () => {
  let ref: HTMLDivElement | undefined;

  onMount(async () => {
    if (!ref) {
      return;
    }

    const platform = getLegacyPlatform();

    const legacyMachine = getLegacyMachine(platform);
    const cache = getLegacyStorage(platform);
    const device = new Device(legacyMachine, cache);

    legacyMachine.initLegacy?.();
    await device.init();
    await cache.init();

    mountDevice(ref, device);
  });

  return <div class="player-frame" ref={ref!} />;
};
