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
import {
  LegacyDebugOverlay,
  LegacyDebugShell,
  formatLegacyConnectionStatus,
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
  let debugOverlay: HTMLAsideElement | undefined;
  let webosDebugDetails: HTMLDivElement | undefined;
  let refreshWebosDebugDetails: (() => void) | undefined;
  const usesWebosDebugShell = getLegacyPlatform() === 'webos';
  const [showDebug, setShowDebug] = createSignal(false);
  const [mounted, setMounted] = createSignal(false);
  const [startupError, setStartupError] = createSignal<string>();
  const [debugContext, setDebugContext] = createSignal<{
    device: LegacyDebugDevice;
    machine: LegacyMachine;
    serverUrl: string;
    platform: LegacyPlatform;
  }>();

  const toggleDebugOverlay = () => {
    const visible = !showDebug();
    setShowDebug(visible);

    // Old WebOS fails to apply some reactive DOM updates after player mount.
    if (debugOverlay) {
      debugOverlay.style.display = visible ? 'block' : 'none';
    }
    if (visible) {
      refreshWebosDebugDetails?.();
    }
    console.log(
      `[legacy debug] Overlay toggled visible=${String(
        visible
      )}, elementMounted=${String(Boolean(debugOverlay))}`
    );
  };

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
      serverUrl: configuredServerUrl ?? 'Stored device configuration',
      platform,
    });
    if (platform === 'webos') {
      const serverUrl = configuredServerUrl ?? 'Stored device configuration';
      const updateWebosDebugDetails = async () => {
        if (!webosDebugDetails) {
          return;
        }

        const rows: Array<[string, string]> = [
          ['Player name', device.name ?? 'Not available'],
          ['Device ID', device.id ?? 'Not available'],
          ['Organization', 'Loading...'],
          ['Castmill network', 'Loading...'],
          ['Server', serverUrl],
          ['Adapter platform', 'webOS'],
          ['Browser connection', navigator.onLine ? 'Online' : 'Offline'],
          [
            'Server connection',
            formatLegacyConnectionStatus(device.getServerConnectionStatus()),
          ],
          ['Viewport', `${window.innerWidth} x ${window.innerHeight}`],
          ['Screen', `${window.screen.width} x ${window.screen.height}`],
          ['Device pixel ratio', String(window.devicePixelRatio || 1)],
        ];
        webosDebugDetails.textContent = rows
          .map(([label, value]) => `${label}: ${value}`)
          .join('\n');

        try {
          await device.refreshIdentity();
          const [organization, network] = await Promise.all([
            device.getOrganizationName(),
            device.getCastmillNetworkName(),
          ]);
          rows[0][1] = device.name ?? 'Not available';
          rows[1][1] = device.id ?? 'Not available';
          rows[2][1] = organization ?? 'Not available';
          rows[3][1] = network ?? 'Not available';
        } catch (error) {
          rows.push([
            'Player identity',
            error instanceof Error ? error.message : String(error),
          ]);
        }

        try {
          const timezone = legacyMachine.getTimezone
            ? await legacyMachine.getTimezone()
            : Intl.DateTimeFormat().resolvedOptions().timeZone;
          rows.push(['Timezone', timezone || 'Not available']);
        } catch (error) {
          rows.push([
            'Timezone',
            error instanceof Error ? error.message : String(error),
          ]);
        }

        try {
          const info = await legacyMachine.getDeviceInfo();
          rows.push(
            ['Application type', info.appType],
            ['Application version', info.appVersion],
            ['Operating system', info.os],
            ['Hardware', info.hardware]
          );
          [
            ['Environment version', info.environmentVersion],
            ['Chromium version', info.chromiumVersion],
            ['V8 version', info.v8Version],
            ['Node.js version', info.nodeVersion],
            ['User agent', info.userAgent],
          ].forEach(([label, value]) => {
            if (value) {
              rows.push([label, value]);
            }
          });
        } catch (error) {
          rows.push([
            'Device information',
            error instanceof Error ? error.message : String(error),
          ]);
        }

        if (webosDebugDetails) {
          webosDebugDetails.textContent = rows
            .map(([label, value]) => `${label}: ${value}`)
            .join('\n');
        }
      };

      refreshWebosDebugDetails = () => {
        void updateWebosDebugDetails();
      };
    }

    if (
      platform === 'android' ||
      platform === 'webos' ||
      platform === 'electron'
    ) {
      const allowedConsoleOrigin = getLegacyParentOrigin();
      const stopListening = listenForLegacyConsoleToggle(
        toggleDebugOverlay,
        allowedConsoleOrigin,
        platform === 'android' || platform === 'webos'
      );
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
        >
          <Show when={!startupError()}>
            <div class="legacy-startup__track">
              <div class="legacy-startup__fill" />
            </div>
          </Show>
          <span>{startupError() ?? 'Initializing player...'}</span>
        </div>
      </Show>
      <Show
        when={usesWebosDebugShell}
        fallback={
          <Show when={debugContext()}>
            {(context) => (
              <LegacyDebugOverlay
                overlayRef={(element) => {
                  debugOverlay = element;
                }}
                visible={showDebug()}
                {...context()}
              />
            )}
          </Show>
        }
      >
        <LegacyDebugShell
          visible={false}
          overlayRef={(element) => {
            debugOverlay = element;
          }}
        >
          <div class="legacy-debug-overlay__title">Player diagnostics</div>
          <div ref={webosDebugDetails!} class="legacy-debug-overlay__status">
            WebOS debug console is open.
          </div>
        </LegacyDebugShell>
      </Show>
    </>
  );
};
