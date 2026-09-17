import {
  Show,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from 'solid-js';
import { mountDevice, Device, BrowserMachine } from '@castmill/device';
import { StorageIntegration, StorageBrowser } from '@castmill/cache';
import {
  AndroidLegacyMachine,
  ElectronLegacyMachine,
  AndroidLegacyFileStorage,
  LegacyMachine,
} from '../classes';
import { getLegacyBaseUrl } from '../utils/base-url';
import {
  LegacyDebugOverlay,
  type LegacyDebugDevice,
  type LegacyPlatform,
} from './legacy-debug-overlay';
import { listenForLegacyConsoleToggle } from './legacy-debug-message';

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
  const [showDebug, setShowDebug] = createSignal(false);
  const [debugContext, setDebugContext] = createSignal<{
    device: LegacyDebugDevice;
    machine: LegacyMachine;
    serverUrl: string;
    platform: LegacyPlatform;
  }>();

  onMount(() => {
    if (!ref) {
      return;
    }

    const platform = getLegacyPlatform();
    const legacyMachine = getLegacyMachine(platform);
    const cache = getLegacyStorage(platform);
    const device = new Device(legacyMachine, cache);
    const configuredServerUrl = getLegacyBaseUrl(
      window.location,
      import.meta.env.VITE_BASE_URL
    );

    setDebugContext({
      device,
      machine: legacyMachine,
      serverUrl: configuredServerUrl ?? 'Stored device configuration',
      platform,
    });

    if (platform === 'android' || platform === 'electron') {
      const allowedConsoleOrigin = new URL(
        configuredServerUrl ?? window.location.origin
      ).origin;
      const stopListening = listenForLegacyConsoleToggle(() => {
        setShowDebug((visible) => !visible);
      }, allowedConsoleOrigin);
      onCleanup(stopListening);
    }

    void (async () => {
      legacyMachine.initLegacy?.();
      await device.init(configuredServerUrl);
      await cache.init();

      mountDevice(ref, device);
    })();
  });

  return (
    <>
      <div class="player-frame" ref={ref!} />
      <Show when={debugContext()}>
        {(context) => (
          <LegacyDebugOverlay visible={showDebug()} {...context()} />
        )}
      </Show>
    </>
  );
};
