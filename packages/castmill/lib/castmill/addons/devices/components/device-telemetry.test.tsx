import { cleanup, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';
import { DeviceTelemetry, formatPercent } from './device-telemetry';

vi.mock('../services/devices.service', () => ({
  DevicesService: { getDeviceTelemetry: vi.fn() },
}));

const device = { id: 'device-1', online: true } as Device;

describe('formatPercent', () => {
  it('rounds and clamps', () => {
    expect(formatPercent(37.894736842105264)).toBe('38%');
    expect(formatPercent(0.4)).toBe('0%');
    expect(formatPercent(100.2)).toBe('100%');
    expect(formatPercent(-1)).toBe('0%');
  });
});

describe('DeviceTelemetry', () => {
  afterEach(cleanup);

  it('shows whole percentages for CPU, signal and battery', async () => {
    vi.mocked(DevicesService.getDeviceTelemetry).mockResolvedValue({
      cpuUsagePercent: 37.894736842105264,
      network: { type: 'wifi', wifiSignalStrengthPercent: 71.5 },
      battery: { levelPercent: 99.6, isCharging: false },
    } as never);

    render(() => <DeviceTelemetry baseUrl="" device={device} />);

    expect(await screen.findByText('38%')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.queryByText(/37\.89/)).toBeNull();
  });
});
