import {
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  type Component,
} from 'solid-js';
import { type DeviceInfo, type ServerConnectionStatus } from '@castmill/device';
import type { LegacyMachine } from '../classes';

export type LegacyPlatform = 'webos' | 'android' | 'electron' | 'browser';

const PLATFORM_NAMES: Record<LegacyPlatform, string> = {
  webos: 'webOS',
  android: 'Android',
  electron: 'Electron',
  browser: 'Browser',
};

export interface LegacyDebugDevice {
  id?: string;
  name?: string;
  getServerConnectionStatus(): ServerConnectionStatus;
  refreshIdentity(): Promise<{ id: string; name: string }>;
  getOrganizationName(): Promise<string | undefined>;
  getCastmillNetworkName(): Promise<string | undefined>;
  on(event: 'ready', listener: () => void): unknown;
  off(event: 'ready', listener: () => void): unknown;
}

interface LegacyDebugOverlayProps {
  visible: boolean;
  device: LegacyDebugDevice;
  machine: Pick<LegacyMachine, 'getDeviceInfo' | 'getTimezone'>;
  serverUrl: string;
  platform: LegacyPlatform;
}

interface RuntimeInfo {
  deviceId: string;
  deviceName: string;
  browserConnection: string;
  serverConnection: string;
  viewport: string;
  screen: string;
  devicePixelRatio: string;
}

interface DebugRow {
  label: string;
  value: string;
}

const formatConnectionStatus = (status: ServerConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'disconnected':
      return 'Disconnected';
    case 'not-initialized':
      return 'Not initialized';
  }
};

const getRuntimeInfo = (device: LegacyDebugDevice): RuntimeInfo => ({
  deviceId: device.id ?? 'Not available',
  deviceName: device.name ?? 'Not available',
  browserConnection: navigator.onLine ? 'Online' : 'Offline',
  serverConnection: formatConnectionStatus(device.getServerConnectionStatus()),
  viewport: `${window.innerWidth} x ${window.innerHeight}`,
  screen: `${window.screen.width} x ${window.screen.height}`,
  devicePixelRatio: String(window.devicePixelRatio || 1),
});

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const LegacyDebugOverlay: Component<LegacyDebugOverlayProps> = (
  props
) => {
  const [runtimeInfo, setRuntimeInfo] = createSignal<RuntimeInfo>(
    getRuntimeInfo(props.device)
  );
  const [organization, setOrganization] = createSignal('Not available');
  const [network, setNetwork] = createSignal('Not available');
  const [deviceInfo, setDeviceInfo] = createSignal<DeviceInfo>();
  const [identityError, setIdentityError] = createSignal<string>();
  const [deviceInfoError, setDeviceInfoError] = createSignal<string>();
  const [timezone, setTimezone] = createSignal<string>();
  const [timezoneError, setTimezoneError] = createSignal<string>();
  const [loading, setLoading] = createSignal(false);

  const updateRuntimeInfo = () => {
    setRuntimeInfo(getRuntimeInfo(props.device));
  };

  const loadIdentity = async () => {
    setIdentityError(undefined);

    try {
      await props.device.refreshIdentity();
      const [organizationName, networkName] = await Promise.all([
        props.device.getOrganizationName(),
        props.device.getCastmillNetworkName(),
      ]);
      setOrganization(organizationName ?? 'Not available');
      setNetwork(networkName ?? 'Not available');
    } catch (error) {
      setIdentityError(getErrorMessage(error));
    } finally {
      updateRuntimeInfo();
    }
  };

  const loadMachineInfo = async () => {
    setLoading(true);
    setDeviceInfoError(undefined);
    setTimezoneError(undefined);

    try {
      setDeviceInfo(await props.machine.getDeviceInfo());
    } catch (error) {
      setDeviceInfoError(getErrorMessage(error));
    }

    try {
      const resolvedTimezone = props.machine.getTimezone
        ? await props.machine.getTimezone()
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(resolvedTimezone || 'Not available');
    } catch (error) {
      setTimezoneError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (!props.visible) {
      return;
    }

    updateRuntimeInfo();
    void loadIdentity();
    void loadMachineInfo();

    const interval = window.setInterval(updateRuntimeInfo, 1000);
    window.addEventListener('online', updateRuntimeInfo);
    window.addEventListener('offline', updateRuntimeInfo);
    window.addEventListener('resize', updateRuntimeInfo);
    props.device.on('ready', updateRuntimeInfo);

    onCleanup(() => {
      window.clearInterval(interval);
      window.removeEventListener('online', updateRuntimeInfo);
      window.removeEventListener('offline', updateRuntimeInfo);
      window.removeEventListener('resize', updateRuntimeInfo);
      props.device.off('ready', updateRuntimeInfo);
    });
  });

  const rows = (): DebugRow[] => {
    const runtime = runtimeInfo();
    const info = deviceInfo();
    const result: DebugRow[] = [
      { label: 'Player name', value: runtime.deviceName },
      { label: 'Device ID', value: runtime.deviceId },
      { label: 'Organization', value: organization() },
      { label: 'Castmill network', value: network() },
      { label: 'Server', value: props.serverUrl },
      {
        label: 'Adapter platform',
        value: PLATFORM_NAMES[props.platform],
      },
      {
        label: 'Browser connection',
        value: runtime.browserConnection,
      },
      {
        label: 'Server connection',
        value: runtime.serverConnection,
      },
      { label: 'Viewport', value: runtime.viewport },
      { label: 'Screen', value: runtime.screen },
      {
        label: 'Device pixel ratio',
        value: runtime.devicePixelRatio,
      },
    ];

    if (timezone()) {
      result.push({
        label: 'Timezone',
        value: timezone()!,
      });
    }

    if (info) {
      result.push(
        { label: 'Application type', value: info.appType },
        {
          label: 'Application version',
          value: info.appVersion,
        },
        { label: 'Operating system', value: info.os },
        { label: 'Hardware', value: info.hardware }
      );

      const optionalInfo: Array<[string, string | undefined]> = [
        ['Environment version', info.environmentVersion],
        ['Chromium version', info.chromiumVersion],
        ['V8 version', info.v8Version],
        ['Node.js version', info.nodeVersion],
        ['User agent', info.userAgent],
      ];

      optionalInfo.forEach(([label, value]) => {
        if (value) {
          result.push({ label, value });
        }
      });
    }

    return result;
  };

  return (
    <Show when={props.visible}>
      <aside
        class="legacy-debug-overlay"
        aria-label="Legacy player diagnostics"
      >
        <div class="legacy-debug-overlay__title">Legacy player diagnostics</div>
        <Show when={loading() && !deviceInfo()}>
          <div class="legacy-debug-overlay__status">
            Loading machine information...
          </div>
        </Show>
        <For each={rows()}>
          {(row) => (
            <div class="legacy-debug-overlay__row">
              <span class="legacy-debug-overlay__label">{row.label}</span>
              <span class="legacy-debug-overlay__value">{row.value}</span>
            </div>
          )}
        </For>
        <Show when={identityError()}>
          <div class="legacy-debug-overlay__error">
            Player identity: {identityError()}
          </div>
        </Show>
        <Show when={deviceInfoError()}>
          <div class="legacy-debug-overlay__error">
            Device information: {deviceInfoError()}
          </div>
        </Show>
        <Show when={timezoneError()}>
          <div class="legacy-debug-overlay__error">
            Timezone: {timezoneError()}
          </div>
        </Show>
      </aside>
    </Show>
  );
};
