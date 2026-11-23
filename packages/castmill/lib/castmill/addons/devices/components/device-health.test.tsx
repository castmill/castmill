import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';
import { DeviceHealth, HEALTH_REFRESH_MS } from './device-health';

vi.mock('../services/devices.service', () => ({
  DevicesService: { getDeviceTelemetry: vi.fn() },
}));

const t = (key: string, params?: Record<string, any>) =>
  params ? `${key} ${JSON.stringify(params)}` : key;

const GB = 1024 ** 3;

const telemetry = {
  memory: { usedBytes: 3 * GB, totalBytes: 4 * GB },
  storage: { usedBytes: 1 * GB, totalBytes: 10 * GB },
  cpuUsagePercent: 85,
  uptimeSeconds: 2 * 86400 + 3 * 3600,
  temperatures: [
    { label: 'cpu', celsius: 55 },
    { label: 'gpu', celsius: 72.25 },
  ],
  network: {
    type: 'wifi',
    wifiSignalStrengthPercent: 30,
    ssid: 'Lobby',
    ipAddress: '10.0.0.2',
  },
  player: {
    uptimeSeconds: 3600,
    connectedSeconds: 120,
    heap: { usedBytes: 50 * 1024 ** 2, limitBytes: 200 * 1024 ** 2 },
  },
  cache: {
    items: 4,
    bytes: 3000,
    types: {
      code: { items: 1, bytes: 0 },
      data: { items: 1, bytes: 1000 },
      media: { items: 2, bytes: 2000 },
    },
  },
};

const device = (overrides: Partial<Device> = {}) =>
  ({ id: 'device-1', online: true, ...overrides }) as Device;

const meter = (name: string) => screen.getByRole('meter', { name });

describe('DeviceHealth', () => {
  beforeEach(() => {
    vi.mocked(DevicesService.getDeviceTelemetry).mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows resource gauges, statistics and cache usage', async () => {
    vi.mocked(DevicesService.getDeviceTelemetry).mockResolvedValue(telemetry);
    render(() => <DeviceHealth baseUrl="/api" device={device()} t={t} />);

    await screen.findByRole('meter', { name: 'devices.telemetry.memory' });
    expect(DevicesService.getDeviceTelemetry).toHaveBeenCalledWith(
      '/api',
      'device-1'
    );

    expect(meter('devices.telemetry.memory')).toHaveAttribute(
      'aria-valuenow',
      '75'
    );
    expect(meter('devices.telemetry.memory')).toHaveAttribute(
      'data-tone',
      'warning'
    );
    expect(meter('devices.health.appMemory')).toHaveAttribute(
      'aria-valuenow',
      '25'
    );
    expect(meter('devices.telemetry.storage')).toHaveAttribute(
      'data-tone',
      'success'
    );
    expect(meter('devices.health.cpu')).toHaveAttribute('data-tone', 'error');

    const tile = (id: string) =>
      document.querySelector(`.device-health-${id}`) as HTMLElement;
    expect(tile('online-for')).toHaveTextContent(
      '2devices.telemetry.minutesShort'
    );
    expect(tile('player-uptime')).toHaveTextContent(
      '1devices.telemetry.hoursShort 0devices.telemetry.minutesShort'
    );
    expect(tile('system-uptime')).toHaveTextContent(
      '2devices.telemetry.daysShort 3devices.telemetry.hoursShort'
    );
    expect(tile('cache-size')).toHaveTextContent('devices.health.cacheItems');
    expect(tile('temperature')).toHaveTextContent('72.3°C');
    expect(tile('temperature')).toHaveTextContent('gpu');
    expect(tile('temperature')).toHaveAttribute('data-tone', 'warning');
    expect(tile('network')).toHaveTextContent('wifi');
    expect(tile('network')).toHaveTextContent('30% · Lobby · 10.0.0.2');
    expect(tile('network')).toHaveAttribute('data-tone', 'error');

    expect(
      screen.getByRole('img', { name: 'devices.health.cacheUsage' })
    ).toBeInTheDocument();
    expect(screen.getByText('devices.cache.mediaTab')).toBeInTheDocument();
  });

  it('shows used bytes when the total is unknown', async () => {
    vi.mocked(DevicesService.getDeviceTelemetry).mockResolvedValue({
      memory: { usedBytes: 1024, totalBytes: 0 },
      network: { ipAddress: '10.0.0.3' },
    });
    render(() => <DeviceHealth baseUrl="/api" device={device()} t={t} />);

    expect(await screen.findByText('1 KB')).toBeInTheDocument();
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByText('10.0.0.3')).toBeInTheDocument();
  });

  it('does not query an offline device', () => {
    render(() => (
      <DeviceHealth baseUrl="/api" device={device({ online: false })} t={t} />
    ));

    expect(screen.getByText('devices.health.offline')).toBeInTheDocument();
    expect(screen.queryByLabelText('devices.health.refresh')).toBeNull();
    expect(DevicesService.getDeviceTelemetry).not.toHaveBeenCalled();
  });

  it('reports load errors and recovers on refresh', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(DevicesService.getDeviceTelemetry)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ cpuUsagePercent: 10 });
    render(() => <DeviceHealth baseUrl="/api" device={device()} t={t} />);

    expect(
      await screen.findByText('devices.health.loadError')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('devices.health.refresh'));

    expect(
      await screen.findByRole('meter', { name: 'devices.health.cpu' })
    ).toBeInTheDocument();
    expect(screen.queryByText('devices.health.loadError')).toBeNull();
  });

  it('shows an empty state when nothing is reported', async () => {
    vi.mocked(DevicesService.getDeviceTelemetry).mockResolvedValue({});
    render(() => <DeviceHealth baseUrl="/api" device={device()} t={t} />);

    expect(
      await screen.findByText('devices.health.noData')
    ).toBeInTheDocument();
  });

  it('refreshes periodically while mounted', async () => {
    vi.useFakeTimers();
    vi.mocked(DevicesService.getDeviceTelemetry).mockResolvedValue({});
    const { unmount } = render(() => (
      <DeviceHealth baseUrl="/api" device={device()} t={t} />
    ));
    await vi.advanceTimersByTimeAsync(0);
    expect(DevicesService.getDeviceTelemetry).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(HEALTH_REFRESH_MS);
    expect(DevicesService.getDeviceTelemetry).toHaveBeenCalledTimes(2);

    unmount();
    await vi.advanceTimersByTimeAsync(HEALTH_REFRESH_MS);
    expect(DevicesService.getDeviceTelemetry).toHaveBeenCalledTimes(2);
  });

  it('reloads when the device comes online, not on unrelated updates', async () => {
    vi.mocked(DevicesService.getDeviceTelemetry).mockResolvedValue({
      cpuUsagePercent: 20,
    });
    const [current, setCurrent] = createSignal(device({ online: false }));
    render(() => <DeviceHealth baseUrl="/api" device={current()} t={t} />);
    expect(DevicesService.getDeviceTelemetry).not.toHaveBeenCalled();

    setCurrent(device({ online: true }));
    await screen.findByRole('meter', { name: 'devices.health.cpu' });
    expect(DevicesService.getDeviceTelemetry).toHaveBeenCalledTimes(1);

    setCurrent(device({ online: true, name: 'Renamed' }));
    expect(DevicesService.getDeviceTelemetry).toHaveBeenCalledTimes(1);
    expect(meter('devices.health.cpu')).toBeInTheDocument();
  });

  it('ignores a response that arrives after the device went offline', async () => {
    let resolve!: (value: Record<string, any>) => void;
    vi.mocked(DevicesService.getDeviceTelemetry).mockReturnValue(
      new Promise<Record<string, any>>((r) => (resolve = r))
    );
    const [current, setCurrent] = createSignal(device());
    render(() => <DeviceHealth baseUrl="/api" device={current()} t={t} />);

    setCurrent(device({ online: false }));
    resolve({ cpuUsagePercent: 50 });
    await Promise.resolve();

    expect(screen.getByText('devices.health.offline')).toBeInTheDocument();
    expect(screen.queryByRole('meter')).toBeNull();
  });
});
