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
import { useLegacyI18n } from '../i18n';

export type LegacyPlatform = 'webos' | 'android' | 'electron' | 'browser';

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

const formatConnectionStatus = (
  status: ServerConnectionStatus,
  t: (key: string) => string
): string => {
  switch (status) {
    case 'connected':
      return t('legacyDebug.status.connected');
    case 'disconnected':
      return t('legacyDebug.status.disconnected');
    case 'not-initialized':
      return t('legacyDebug.status.notInitialized');
  }
};

const getRuntimeInfo = (
  device: LegacyDebugDevice,
  t: (key: string) => string
): RuntimeInfo => ({
  deviceId: device.id ?? t('legacyDebug.values.unavailable'),
  deviceName: device.name ?? t('legacyDebug.values.unavailable'),
  browserConnection: navigator.onLine
    ? t('legacyDebug.status.online')
    : t('legacyDebug.status.offline'),
  serverConnection: formatConnectionStatus(
    device.getServerConnectionStatus(),
    t
  ),
  viewport: `${window.innerWidth} x ${window.innerHeight}`,
  screen: `${window.screen.width} x ${window.screen.height}`,
  devicePixelRatio: String(window.devicePixelRatio || 1),
});

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const LegacyDebugOverlay: Component<LegacyDebugOverlayProps> = (
  props
) => {
  const { isRtl, t } = useLegacyI18n();
  const [runtimeInfo, setRuntimeInfo] = createSignal<RuntimeInfo>(
    getRuntimeInfo(props.device, t)
  );
  const [organization, setOrganization] = createSignal(
    t('legacyDebug.values.unavailable')
  );
  const [network, setNetwork] = createSignal(
    t('legacyDebug.values.unavailable')
  );
  const [deviceInfo, setDeviceInfo] = createSignal<DeviceInfo>();
  const [identityError, setIdentityError] = createSignal<string>();
  const [deviceInfoError, setDeviceInfoError] = createSignal<string>();
  const [timezone, setTimezone] = createSignal<string>();
  const [timezoneError, setTimezoneError] = createSignal<string>();
  const [loading, setLoading] = createSignal(false);

  const updateRuntimeInfo = () => {
    setRuntimeInfo(getRuntimeInfo(props.device, t));
  };

  const loadIdentity = async () => {
    setIdentityError(undefined);

    try {
      await props.device.refreshIdentity();
      const [organizationName, networkName] = await Promise.all([
        props.device.getOrganizationName(),
        props.device.getCastmillNetworkName(),
      ]);
      setOrganization(
        organizationName ?? t('legacyDebug.values.unavailable')
      );
      setNetwork(networkName ?? t('legacyDebug.values.unavailable'));
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
      setTimezone(resolvedTimezone || t('legacyDebug.values.unavailable'));
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
      { label: t('legacyDebug.rows.playerName'), value: runtime.deviceName },
      { label: t('legacyDebug.rows.deviceId'), value: runtime.deviceId },
      { label: t('legacyDebug.rows.organization'), value: organization() },
      { label: t('legacyDebug.rows.castmillNetwork'), value: network() },
      { label: t('legacyDebug.rows.server'), value: props.serverUrl },
      {
        label: t('legacyDebug.rows.adapterPlatform'),
        value: t(`legacyDebug.platform.${props.platform}`),
      },
      {
        label: t('legacyDebug.rows.browserConnection'),
        value: runtime.browserConnection,
      },
      {
        label: t('legacyDebug.rows.serverConnection'),
        value: runtime.serverConnection,
      },
      { label: t('legacyDebug.rows.viewport'), value: runtime.viewport },
      { label: t('legacyDebug.rows.screen'), value: runtime.screen },
      {
        label: t('legacyDebug.rows.devicePixelRatio'),
        value: runtime.devicePixelRatio,
      },
    ];

    if (timezone()) {
      result.push({
        label: t('legacyDebug.rows.timezone'),
        value: timezone()!,
      });
    }

    if (info) {
      result.push(
        { label: t('legacyDebug.rows.applicationType'), value: info.appType },
        {
          label: t('legacyDebug.rows.applicationVersion'),
          value: info.appVersion,
        },
        { label: t('legacyDebug.rows.operatingSystem'), value: info.os },
        { label: t('legacyDebug.rows.hardware'), value: info.hardware }
      );

      const optionalInfo: Array<[string, string | undefined]> = [
        [t('legacyDebug.rows.environmentVersion'), info.environmentVersion],
        [t('legacyDebug.rows.chromiumVersion'), info.chromiumVersion],
        [t('legacyDebug.rows.v8Version'), info.v8Version],
        [t('legacyDebug.rows.nodeVersion'), info.nodeVersion],
        [t('legacyDebug.rows.userAgent'), info.userAgent],
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
        aria-label={t('legacyDebug.ariaLabel')}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div class="legacy-debug-overlay__title">{t('legacyDebug.title')}</div>
        <Show when={loading() && !deviceInfo()}>
          <div class="legacy-debug-overlay__status">
            {t('legacyDebug.loading')}
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
            {t('legacyDebug.errors.playerIdentity')}: {identityError()}
          </div>
        </Show>
        <Show when={deviceInfoError()}>
          <div class="legacy-debug-overlay__error">
            {t('legacyDebug.errors.deviceInformation')}: {deviceInfoError()}
          </div>
        </Show>
        <Show when={timezoneError()}>
          <div class="legacy-debug-overlay__error">
            {t('legacyDebug.errors.timezone')}: {timezoneError()}
          </div>
        </Show>
      </aside>
    </Show>
  );
};
