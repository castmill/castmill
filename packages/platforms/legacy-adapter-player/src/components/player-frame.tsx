import {
  Show,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from 'solid-js';
import { mountDevice, Device, BrowserMachine } from '@castmill/device';
import {
  MemoryCache,
  StorageIntegration,
  StorageBrowser,
} from '@castmill/cache';
import {
  AndroidLegacyMachine,
  ElectronLegacyMachine,
  WebosLegacyMachine,
  AndroidLegacyFileStorage,
  WebosLegacyFileStorage,
  LegacyMachine,
} from '../classes';
import { getLegacyBaseUrl } from '../utils/base-url';
import { WebosWebSocket } from '../webos-legacy-api';
import { createWebosVideoPlayback } from '../classes/webos-video-playback';
import { useLegacyI18n } from '../i18n';
import {
  LegacyDebugOverlay,
  type LegacyDebugDevice,
  type LegacyPlatform,
} from './legacy-debug-overlay';
import { listenForLegacyConsoleToggle } from './legacy-debug-message';

export const getLegacyParentOrigin = (
  referrer = document.referrer,
  fallbackOrigin = window.location.origin
): string => {
  try {
    return referrer ? new URL(referrer).origin : fallbackOrigin;
  } catch {
    return fallbackOrigin;
  }
};

export const getLegacyPlatform = (
  userAgent: string = navigator.userAgent
): LegacyPlatform => {
  if (/web[0o]s/i.test(userAgent)) {
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
    case 'webos':
      return new WebosLegacyMachine();
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
    case 'webos':
      return new WebosLegacyFileStorage();
    case 'android':
      // TODO: Check if storagebrowser works on our Android hardware
      // return new StorageBrowser(); // Doesn't work when running non-https. Check if it works on prod endpoint
      return new AndroidLegacyFileStorage('');
    case 'electron':
      // Legacy electron player doesn't provide any APIs downloading files so
      // we use the browser storage implementation.
      return new StorageBrowser('file-cache', '', false);
    case 'browser':
      return new StorageBrowser('file-cache', '', false);
  }
};

export const PlayerFrame: Component = () => {
  let ref: HTMLDivElement | undefined;
  let startupOverlay: HTMLDivElement | undefined;
  const { isRtl, t } = useLegacyI18n();
  const [showDebug, setShowDebug] = createSignal(false);
  const [mounted, setMounted] = createSignal(false);
  const [startupError, setStartupError] = createSignal<string>();
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
    const memoryCache =
      platform === 'webos' ? new MemoryCache(cache) : undefined;
    const device = new Device(
      legacyMachine,
      cache,
      platform === 'webos'
        ? {
            transport: WebosWebSocket,
            createVideoPlaybackController: createWebosVideoPlayback,
            cacheBackend: memoryCache,
          }
        : undefined
    );
    const configuredServerUrl = getLegacyBaseUrl(
      window.location,
      import.meta.env.VITE_BASE_URL
    );

    setDebugContext({
      device,
      machine: legacyMachine,
      serverUrl:
        configuredServerUrl ??
        t('legacyDebug.values.storedDeviceConfiguration'),
      platform,
    });

    if (platform === 'android' || platform === 'electron') {
      const allowedConsoleOrigin = getLegacyParentOrigin();
      const stopListening = listenForLegacyConsoleToggle(() => {
        setShowDebug((visible) => !visible);
      }, allowedConsoleOrigin);
      onCleanup(stopListening);
    }

    let startupStep = 'legacy bridge';
    void (async () => {
      legacyMachine.initLegacy?.();
      startupStep = 'device configuration';
      await device.init(configuredServerUrl);
      startupStep = 'cache initialization';
      await cache.init();

      startupStep = 'device mount';
      mountDevice(ref, device);
      if (startupOverlay) startupOverlay.style.display = 'none';
      setMounted(true);
      if (platform === 'webos') {
        startupStep = 'wrapper notification';
        (legacyMachine as WebosLegacyMachine).notifyReady();
      }
    })().catch((error: unknown) => {
      console.error(
        `Legacy adapter initialization failed during ${startupStep}`,
        error,
        error instanceof Error ? error.stack : undefined
      );
      setStartupError(error instanceof Error ? error.message : String(error));
    });
  });

  return (
    <>
      <div class="player-frame" ref={ref!} />
      <Show when={!mounted()}>
        <div
          class="legacy-startup"
          ref={startupOverlay!}
          role={startupError() ? 'alert' : 'status'}
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <Show when={!startupError()}>
            <div class="legacy-startup__track">
              <div class="legacy-startup__fill" />
            </div>
          </Show>
          <span>{startupError() ?? t('legacyPlayer.initializing')}</span>
        </div>
      </Show>
      <Show when={debugContext()}>
        {(context) => (
          <LegacyDebugOverlay visible={showDebug()} {...context()} />
        )}
      </Show>
    </>
  );
};
