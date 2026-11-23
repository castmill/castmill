import {
  Component,
  For,
  JSX,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import {
  BsArrowClockwise,
  BsClock,
  BsGlobe,
  BsHddStack,
  BsHeartPulse,
  BsPlayCircle,
  BsThermometerHalf,
  BsWifi,
} from 'solid-icons/bs';
import type { DeviceTelemetryData } from '@castmill/device';
import {
  MetricGauge,
  MetricGrid,
  SectionCard,
  SegmentedBar,
  StatTile,
  formatBytes,
  metricTone,
  usagePercent,
} from '@castmill/ui-common';
import { Device } from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';
import { DeviceIconButton, DeviceNotice } from './device-section';
import { formatUptime } from './format-uptime';
import './device-health.scss';

export const HEALTH_REFRESH_MS = 60_000;

const CPU_THRESHOLDS = { warning: 50, critical: 80 };
const TEMPERATURE_THRESHOLDS = { warning: 60, critical: 80 };
const SIGNAL_THRESHOLDS = { warning: 70, critical: 40, invert: true };
const CACHE_TYPES = ['media', 'data', 'code'] as const;

type Translate = (key: string, params?: Record<string, any>) => string;

interface Gauge {
  id: string;
  label: string;
  used: number;
  total: number;
}

/**
 * At-a-glance health dashboard of a device: resource gauges (memory, storage,
 * CPU), online time, uptimes, cache size and connectivity.
 */
export const DeviceHealth: Component<{
  baseUrl: string;
  device: Device;
  t: Translate;
}> = (props) => {
  const t = props.t;
  const [telemetry, setTelemetry] = createSignal<DeviceTelemetryData>();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal(false);
  let request = 0;

  const fetchHealth = async () => {
    if (!props.device.online || loading()) return;
    const current = ++request;
    setLoading(true);
    setError(false);
    try {
      const data = await DevicesService.getDeviceTelemetry(
        props.baseUrl,
        props.device.id
      );
      if (current === request) setTelemetry(data as DeviceTelemetryData);
    } catch (err) {
      if (current === request) setError(true);
      console.error('Error loading device health:', err);
    } finally {
      if (current === request) setLoading(false);
    }
  };

  // Memoized so that unrelated device updates do not trigger a reload.
  const connection = createMemo(
    () => `${props.device.id}:${props.device.online ? 1 : 0}`
  );
  createEffect(
    on(connection, () => {
      // Ignore responses for a previous device or connection.
      request++;
      setLoading(false);
      setError(false);
      setTelemetry(undefined);
      void fetchHealth();
    })
  );

  const timer = setInterval(() => void fetchHealth(), HEALTH_REFRESH_MS);
  onCleanup(() => {
    clearInterval(timer);
    request++;
  });

  const gauges = (): Gauge[] => {
    const data = telemetry();
    if (!data) return [];
    const list: Gauge[] = [];
    if (data.memory)
      list.push({
        id: 'memory',
        label: t('devices.telemetry.memory'),
        used: data.memory.usedBytes,
        total: data.memory.totalBytes,
      });
    if (data.player?.heap)
      list.push({
        id: 'app-memory',
        label: t('devices.health.appMemory'),
        used: data.player.heap.usedBytes,
        total: data.player.heap.limitBytes,
      });
    if (data.storage)
      list.push({
        id: 'storage',
        label: t('devices.telemetry.storage'),
        used: data.storage.usedBytes,
        total: data.storage.totalBytes,
      });
    return list;
  };

  const hottest = () =>
    telemetry()?.temperatures?.reduce<
      { label: string; celsius: number } | undefined
    >(
      (max, reading) =>
        Number.isFinite(reading.celsius) &&
        (!max || reading.celsius > max.celsius)
          ? reading
          : max,
      undefined
    );

  const network = () => {
    const data = telemetry()?.network;
    if (!data) return undefined;
    const signal = data.wifiSignalStrengthPercent;
    const value = data.type || (signal !== undefined ? `${signal}%` : '');
    const detail = [
      data.type && signal !== undefined ? `${signal}%` : undefined,
      data.ssid,
      data.ipAddress,
    ]
      .filter(Boolean)
      .join(' · ');
    if (!value && !detail) return undefined;
    return {
      value: value || data.ipAddress || '',
      detail: value ? detail : undefined,
      tone:
        signal !== undefined
          ? metricTone(signal, SIGNAL_THRESHOLDS)
          : ('info' as const),
    };
  };

  const tiles = (): Array<{
    id: string;
    label: string;
    icon: typeof BsClock;
    value: JSX.Element;
    detail?: JSX.Element;
    tone?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  }> => {
    const data = telemetry();
    if (!data) return [];
    const list = [];
    if (data.player?.connectedSeconds !== undefined)
      list.push({
        id: 'online-for',
        label: t('devices.health.onlineFor'),
        icon: BsWifi,
        value: formatUptime(data.player.connectedSeconds, t),
        tone: 'success' as const,
      });
    if (data.player)
      list.push({
        id: 'player-uptime',
        label: t('devices.health.playerUptime'),
        icon: BsPlayCircle,
        value: formatUptime(data.player.uptimeSeconds, t),
        tone: 'info' as const,
      });
    if (data.uptimeSeconds !== undefined)
      list.push({
        id: 'system-uptime',
        label: t('devices.health.systemUptime'),
        icon: BsClock,
        value: formatUptime(data.uptimeSeconds, t),
        tone: 'info' as const,
      });
    if (data.cache)
      list.push({
        id: 'cache-size',
        label: t('devices.health.cacheSize'),
        icon: BsHddStack,
        value: formatBytes(data.cache.bytes),
        detail: t('devices.health.cacheItems', { count: data.cache.items }),
        tone: 'info' as const,
      });
    const temperature = hottest();
    if (temperature)
      list.push({
        id: 'temperature',
        label: t('devices.telemetry.temperature'),
        icon: BsThermometerHalf,
        value: `${temperature.celsius.toFixed(1)}°C`,
        detail: temperature.label,
        tone: metricTone(temperature.celsius, TEMPERATURE_THRESHOLDS),
      });
    const net = network();
    if (net)
      list.push({
        id: 'network',
        label: t('devices.telemetry.network'),
        icon: BsGlobe,
        value: net.value,
        detail: net.detail,
        tone: net.tone,
      });
    return list;
  };

  const cacheSegments = () => {
    const cache = telemetry()?.cache;
    if (!cache || cache.bytes <= 0) return [];
    return CACHE_TYPES.map((type, index) => ({
      label: t(`devices.cache.${type}Tab`),
      value: cache.types[type].bytes,
      valueText: formatBytes(cache.types[type].bytes),
      tone: (['info', 'success', 'warning'] as const)[index],
    }));
  };

  const cpu = () => telemetry()?.cpuUsagePercent;

  const hasMetrics = () =>
    gauges().length > 0 || tiles().length > 0 || cpu() !== undefined;

  return (
    <SectionCard
      class="device-health"
      icon={BsHeartPulse}
      title={t('devices.health.title')}
      description={t('devices.health.description')}
      aria-label={t('devices.health.title')}
      actions={
        <Show when={props.device.online}>
          <DeviceIconButton
            icon={BsArrowClockwise}
            label={t('devices.health.refresh')}
            disabled={loading()}
            onClick={() => void fetchHealth()}
          />
        </Show>
      }
    >
      <Show
        when={props.device.online}
        fallback={
          <DeviceNotice tone="offline">
            <p>{t('devices.health.offline')}</p>
          </DeviceNotice>
        }
      >
        <Show when={error()}>
          <DeviceNotice tone="error">
            <p>{t('devices.health.loadError')}</p>
          </DeviceNotice>
        </Show>

        <Show
          when={hasMetrics()}
          fallback={
            <Show when={!error()}>
              <p class="device-health-empty" aria-live="polite">
                {loading()
                  ? t('devices.health.loading')
                  : t('devices.health.noData')}
              </p>
            </Show>
          }
        >
          <div class="device-health-body" aria-busy={loading()}>
            <Show when={gauges().length > 0 || cpu() !== undefined}>
              <MetricGrid minItemWidth="8.5em">
                <For each={gauges()}>
                  {(gauge) => {
                    const percent = () => usagePercent(gauge.used, gauge.total);
                    return (
                      <Show
                        when={percent() !== undefined}
                        fallback={
                          <StatTile
                            label={gauge.label}
                            value={formatBytes(gauge.used)}
                          />
                        }
                      >
                        <MetricGauge
                          class={`device-health-${gauge.id}`}
                          label={gauge.label}
                          value={percent()!}
                          detail={t('devices.health.usedOf', {
                            used: formatBytes(gauge.used),
                            total: formatBytes(gauge.total),
                          })}
                        />
                      </Show>
                    );
                  }}
                </For>
                <Show when={cpu() !== undefined}>
                  <MetricGauge
                    class="device-health-cpu"
                    label={t('devices.health.cpu')}
                    value={cpu()!}
                    thresholds={CPU_THRESHOLDS}
                  />
                </Show>
              </MetricGrid>
            </Show>

            <Show when={tiles().length > 0}>
              <MetricGrid minItemWidth="10em">
                <For each={tiles()}>
                  {(tile) => (
                    <StatTile
                      class={`device-health-${tile.id}`}
                      label={tile.label}
                      icon={tile.icon}
                      value={tile.value}
                      detail={tile.detail}
                      tone={tile.tone}
                    />
                  )}
                </For>
              </MetricGrid>
            </Show>

            <Show when={cacheSegments().length > 0}>
              <div class="device-health-cache">
                <h4>{t('devices.health.cacheUsage')}</h4>
                <SegmentedBar
                  label={t('devices.health.cacheUsage')}
                  segments={cacheSegments()}
                />
              </div>
            </Show>
          </div>
        </Show>
      </Show>
    </SectionCard>
  );
};
