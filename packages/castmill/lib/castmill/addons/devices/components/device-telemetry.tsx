import { Component, createSignal, onMount, Show, For } from 'solid-js';
import {
  BsDeviceHdd,
  BsMemory,
  BsCpu,
  BsBarChartFill,
  BsGlobe,
  BsThermometerHalf,
  BsFan,
  BsBatteryFull,
  BsClock,
  BsLightningFill,
} from 'solid-icons/bs';
import { LoadingOverlay, formatBytes } from '@castmill/ui-common';
import { Device } from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';
import styles from './device-telemetry.module.scss';

interface TelemetryData {
  storage?: { totalBytes: number; usedBytes: number };
  memory?: { totalBytes: number; usedBytes: number };
  cpuUsagePercent?: number;
  cpuLoadAvg?: { one: number; five: number; fifteen: number };
  temperatures?: Array<{ label: string; celsius: number }>;
  fanSpeeds?: Array<{ label: string; rpm: number }>;
  network?: {
    type?: string;
    wifiSignalStrengthPercent?: number;
    ssid?: string;
    ipAddress?: string;
  };
  battery?: { levelPercent: number; isCharging: boolean };
  uptimeSeconds?: number;
}

/**
 * Returns a color based on usage percentage.
 * Green when plenty of free space, yellow when getting low, red when critical.
 */
const getUsageColor = (usedPercent: number): string => {
  if (usedPercent >= 90) return '#e74c3c'; // red — critical
  if (usedPercent >= 70) return '#f0ad4e'; // yellow — warning
  return '#4caf50'; // green — healthy
};

/**
 * Returns a color for CPU load (higher = worse).
 */
const getCpuColor = (percent: number): string => {
  if (percent >= 80) return '#e74c3c';
  if (percent >= 50) return '#f0ad4e';
  return '#4caf50';
};

/**
 * Returns a color for temperature readings.
 */
const getTempColor = (celsius: number): string => {
  if (celsius >= 80) return '#e74c3c';
  if (celsius >= 60) return '#f0ad4e';
  return '#4caf50';
};

/**
 * Returns a color for WiFi signal strength.
 */
const getSignalColor = (percent: number): string => {
  if (percent < 40) return '#e74c3c';
  if (percent < 70) return '#f0ad4e';
  return '#4caf50';
};

/**
 * Formats seconds into a human-readable uptime string.
 */
const formatUptime = (
  seconds: number,
  t: (key: string, params?: Record<string, any>) => string
): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}${t('devices.telemetry.daysShort')}`);
  if (hours > 0) parts.push(`${hours}${t('devices.telemetry.hoursShort')}`);
  parts.push(`${minutes}${t('devices.telemetry.minutesShort')}`);
  return parts.join(' ');
};

/**
 * ProgressBar component used for storage, memory, CPU gauges.
 */
const ProgressBar: Component<{ percent: number; color: string }> = (props) => {
  return (
    <div class={styles.progressBarContainer}>
      <div
        class={styles.progressBarFill}
        style={{
          width: `${Math.min(100, Math.max(0, props.percent))}%`,
          background: props.color,
        }}
      />
    </div>
  );
};

/**
 * WiFi signal bars component.
 */
const SignalBars: Component<{ percent: number }> = (props) => {
  const color = getSignalColor(props.percent);
  const bars = 5;
  const activeBars = Math.round((props.percent / 100) * bars);

  return (
    <div class={styles.signalBars}>
      <For each={Array.from({ length: bars }, (_, i) => i)}>
        {(i) => (
          <div
            class={`${styles.signalBar} ${i < activeBars ? styles.signalBarActive : ''}`}
            style={{
              height: `${((i + 1) / bars) * 100}%`,
              background: i < activeBars ? color : undefined,
            }}
          />
        )}
      </For>
    </div>
  );
};

export const DeviceTelemetry: Component<{
  baseUrl: string;
  device: Device;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  const [telemetry, setTelemetry] = createSignal<TelemetryData | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const fetchTelemetry = async () => {
    if (!props.device.online) return;
    setLoading(true);
    setError(null);
    try {
      const data = await DevicesService.getDeviceTelemetry(
        props.baseUrl,
        props.device.id
      );
      setTelemetry(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    if (props.device.online) {
      fetchTelemetry();
    }
  });

  const hasData = () => {
    const d = telemetry();
    if (!d) return false;
    return (
      d.storage ||
      d.memory ||
      d.cpuUsagePercent !== undefined ||
      d.cpuLoadAvg ||
      d.temperatures?.length ||
      d.fanSpeeds?.length ||
      d.network ||
      d.battery ||
      d.uptimeSeconds !== undefined
    );
  };

  return (
    <div class={styles.container}>
      <Show
        when={props.device.online}
        fallback={
          <div class={styles.offlineWarning}>
            <p>{t('devices.telemetry.offlineWarning')}</p>
          </div>
        }
      >
        <Show when={error()}>
          <div class={styles.errorMessage}>{error()}</div>
        </Show>

        <Show
          when={hasData()}
          fallback={
            <Show when={!loading() && !error()}>
              <div class={styles.noData}>{t('devices.telemetry.noData')}</div>
            </Show>
          }
        >
          <div class={styles.grid}>
            {/* Storage Card */}
            <Show when={telemetry()?.storage}>
              {(storage) => {
                const usedPercent = () =>
                  storage().totalBytes > 0
                    ? Math.round(
                        (storage().usedBytes / storage().totalBytes) * 100
                      )
                    : 0;
                return (
                  <div class={styles.card}>
                    <div class={styles.cardHeader}>
                      <span class={styles.cardIcon}>
                        <BsDeviceHdd />
                      </span>
                      {t('devices.telemetry.storage')}
                    </div>
                    <div
                      class={styles.cardValue}
                      style={{ color: getUsageColor(usedPercent()) }}
                    >
                      {usedPercent()}%
                    </div>
                    <ProgressBar
                      percent={usedPercent()}
                      color={getUsageColor(usedPercent())}
                    />
                    <div class={styles.cardDetail}>
                      {formatBytes(storage().usedBytes)} /{' '}
                      {formatBytes(storage().totalBytes)}
                    </div>
                  </div>
                );
              }}
            </Show>

            {/* Memory Card */}
            <Show when={telemetry()?.memory}>
              {(memory) => {
                const usedPercent = () =>
                  memory().totalBytes > 0
                    ? Math.round(
                        (memory().usedBytes / memory().totalBytes) * 100
                      )
                    : 0;
                const showPercent = () => memory().totalBytes > 0;
                return (
                  <div class={styles.card}>
                    <div class={styles.cardHeader}>
                      <span class={styles.cardIcon}>
                        <BsMemory />
                      </span>
                      {t('devices.telemetry.memory')}
                    </div>
                    <Show
                      when={showPercent()}
                      fallback={
                        <div class={styles.cardValue}>
                          {formatBytes(memory().usedBytes)}
                        </div>
                      }
                    >
                      <div
                        class={styles.cardValue}
                        style={{ color: getUsageColor(usedPercent()) }}
                      >
                        {usedPercent()}%
                      </div>
                      <ProgressBar
                        percent={usedPercent()}
                        color={getUsageColor(usedPercent())}
                      />
                      <div class={styles.cardDetail}>
                        {formatBytes(memory().usedBytes)} /{' '}
                        {formatBytes(memory().totalBytes)}
                      </div>
                    </Show>
                  </div>
                );
              }}
            </Show>

            {/* CPU Usage Card */}
            <Show when={telemetry()?.cpuUsagePercent !== undefined}>
              {() => {
                const percent = () => telemetry()!.cpuUsagePercent!;
                return (
                  <div class={styles.card}>
                    <div class={styles.cardHeader}>
                      <span class={styles.cardIcon}>
                        <BsCpu />
                      </span>
                      {t('devices.telemetry.cpu')}
                    </div>
                    <div
                      class={styles.cardValue}
                      style={{ color: getCpuColor(percent()) }}
                    >
                      {percent()}%
                    </div>
                    <ProgressBar
                      percent={percent()}
                      color={getCpuColor(percent())}
                    />
                  </div>
                );
              }}
            </Show>

            {/* CPU Load Average Card */}
            <Show when={telemetry()?.cpuLoadAvg}>
              {(loadAvg) => (
                <div class={styles.card}>
                  <div class={styles.cardHeader}>
                    <span class={styles.cardIcon}>
                      <BsBarChartFill />
                    </span>
                    {t('devices.telemetry.cpuLoad')}
                  </div>
                  <div class={styles.loadAvgContainer}>
                    <div class={styles.loadAvgPill}>
                      <span class={styles.loadAvgLabel}>1m</span>
                      <span class={styles.loadAvgValue}>
                        {loadAvg().one.toFixed(2)}
                      </span>
                    </div>
                    <div class={styles.loadAvgPill}>
                      <span class={styles.loadAvgLabel}>5m</span>
                      <span class={styles.loadAvgValue}>
                        {loadAvg().five.toFixed(2)}
                      </span>
                    </div>
                    <div class={styles.loadAvgPill}>
                      <span class={styles.loadAvgLabel}>15m</span>
                      <span class={styles.loadAvgValue}>
                        {loadAvg().fifteen.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </Show>

            {/* Network Card */}
            <Show when={telemetry()?.network}>
              {(network) => (
                <div class={styles.card}>
                  <div class={styles.cardHeader}>
                    <span class={styles.cardIcon}>
                      <BsGlobe />
                    </span>
                    {t('devices.telemetry.network')}
                  </div>
                  <Show
                    when={network().wifiSignalStrengthPercent !== undefined}
                  >
                    <div
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        gap: '0.5em',
                      }}
                    >
                      <SignalBars
                        percent={network().wifiSignalStrengthPercent!}
                      />
                      <span
                        class={styles.cardValue}
                        style={{
                          'font-size': '1.1em',
                          color: getSignalColor(
                            network().wifiSignalStrengthPercent!
                          ),
                        }}
                      >
                        {network().wifiSignalStrengthPercent}%
                      </span>
                    </div>
                  </Show>
                  <div class={styles.networkInfo}>
                    <Show when={network().type}>
                      <div class={styles.networkRow}>
                        <span class={styles.networkLabel}>
                          {t('devices.telemetry.connectionType')}
                        </span>
                        <span class={styles.networkValue}>
                          {network().type}
                        </span>
                      </div>
                    </Show>
                    <Show when={network().ssid}>
                      <div class={styles.networkRow}>
                        <span class={styles.networkLabel}>SSID</span>
                        <span class={styles.networkValue}>
                          {network().ssid}
                        </span>
                      </div>
                    </Show>
                    <Show when={network().ipAddress}>
                      <div class={styles.networkRow}>
                        <span class={styles.networkLabel}>IP</span>
                        <span class={styles.networkValue}>
                          {network().ipAddress}
                        </span>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </Show>

            {/* Temperature Card */}
            <Show
              when={
                telemetry()?.temperatures &&
                telemetry()!.temperatures!.length > 0
              }
            >
              <div class={styles.card}>
                <div class={styles.cardHeader}>
                  <span class={styles.cardIcon}>
                    <BsThermometerHalf />
                  </span>
                  {t('devices.telemetry.temperature')}
                </div>
                <div class={styles.tempList}>
                  <For each={telemetry()!.temperatures!}>
                    {(temp) => (
                      <div class={styles.tempItem}>
                        <span class={styles.tempLabel}>{temp.label}</span>
                        <span
                          class={styles.tempValue}
                          style={{ color: getTempColor(temp.celsius) }}
                        >
                          {temp.celsius.toFixed(1)}°C
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Fan Speed Card */}
            <Show
              when={
                telemetry()?.fanSpeeds && telemetry()!.fanSpeeds!.length > 0
              }
            >
              <div class={styles.card}>
                <div class={styles.cardHeader}>
                  <span class={styles.cardIcon}>
                    <BsFan />
                  </span>
                  {t('devices.telemetry.fanSpeed')}
                </div>
                <div class={styles.fanList}>
                  <For each={telemetry()!.fanSpeeds!}>
                    {(fan) => (
                      <div class={styles.fanItem}>
                        <span class={styles.fanLabel}>{fan.label}</span>
                        <span class={styles.fanValue}>{fan.rpm} RPM</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Battery Card */}
            <Show when={telemetry()?.battery}>
              {(battery) => {
                const color = () => getUsageColor(100 - battery().levelPercent);
                return (
                  <div class={styles.card}>
                    <div class={styles.cardHeader}>
                      <span class={styles.cardIcon}>
                        <BsBatteryFull />
                      </span>
                      {t('devices.telemetry.battery')}
                    </div>
                    <div class={styles.batteryContainer}>
                      <span class={styles.cardValue} style={{ color: color() }}>
                        {battery().levelPercent}%
                      </span>
                      <Show when={battery().isCharging}>
                        <span class={styles.chargingIcon}>
                          <BsLightningFill /> {t('devices.telemetry.charging')}
                        </span>
                      </Show>
                    </div>
                    <ProgressBar
                      percent={battery().levelPercent}
                      color={color()}
                    />
                  </div>
                );
              }}
            </Show>

            {/* Uptime Card */}
            <Show when={telemetry()?.uptimeSeconds !== undefined}>
              <div class={styles.card}>
                <div class={styles.cardHeader}>
                  <span class={styles.cardIcon}>
                    <BsClock />
                  </span>
                  {t('devices.telemetry.uptime')}
                </div>
                <div class={styles.cardValue} style={{ 'font-size': '1.1em' }}>
                  {formatUptime(telemetry()!.uptimeSeconds!, t)}
                </div>
              </div>
            </Show>
          </div>
        </Show>

        <LoadingOverlay show={loading()} />
      </Show>
    </div>
  );
};
