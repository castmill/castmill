import { render, screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { DeviceInfo } from './device-info';
import { Device } from '../interfaces/device.interface';

const t = (key: string) =>
  (
    ({
      'common.notAvailable': 'N/A',
      'common.timezone': 'Timezone',
      'devices.info.platform': 'Platform',
      'devices.info.playerVersion': 'Player version',
      'devices.info.operatingSystem': 'Operating system',
      'devices.info.hardware': 'Hardware',
      'devices.info.environmentVersion': 'Environment version',
      'devices.info.chromiumVersion': 'Chromium version',
      'devices.info.v8Version': 'V8 version',
      'devices.info.nodeVersion': 'Node.js version',
      'devices.info.userAgent': 'User agent',
      'devices.info.cpu': 'Processor',
      'devices.info.memory': 'Memory',
      'devices.info.gpu': 'Graphics',
      'devices.info.graphicsAcceleration': 'Graphics acceleration',
      'devices.info.graphicsAccelerationHardware': 'Hardware (GPU)',
      'devices.info.graphicsAccelerationSoftware': 'Software only (CPU)',
      'devices.info.videoDecoding': 'Hardware video decoding',
      'devices.info.videoDecodingNone': 'None',
      'devices.info.display': 'Display',
    }) as Record<string, string>
  )[key] || key;

const device = {
  id: 'device-1',
  name: 'Test device',
  info: {
    appType: 'Electron',
    appVersion: '1.2.3',
    os: 'Linux',
    hardware: 'x86_64',
    environmentVersion: 'Electron 28',
    chromiumVersion: '120',
    v8Version: '12',
    nodeVersion: '20',
    userAgent: 'Castmill Player',
  },
  timezone: 'Europe/Stockholm',
} as Device;

describe('DeviceInfo', () => {
  it('renders the player and platform metadata', () => {
    render(() => <DeviceInfo device={device} t={t} />);

    for (const value of [
      'Electron',
      '1.2.3',
      'Linux',
      'x86_64',
      'Electron 28',
      '120',
      '12',
      '20',
      'Europe/Stockholm',
      'Castmill Player',
    ]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  it('hides unavailable runtime-only versions', () => {
    render(() => (
      <DeviceInfo
        device={{ ...device, info: { appType: 'WebOS' } } as Device}
        t={t}
      />
    ));

    expect(screen.getByText('WebOS')).toBeInTheDocument();
    expect(screen.queryByText('Chromium version')).not.toBeInTheDocument();
    expect(screen.queryByText('Node.js version')).not.toBeInTheDocument();
    expect(screen.getByText('Hardware')).toBeInTheDocument();
  });

  it('falls back to legacy metadata and translated missing values', () => {
    render(() => (
      <DeviceInfo
        device={
          {
            ...device,
            info: null,
            version: '0.0.1',
            user_agent: 'Legacy player',
            timezone: undefined,
          } as Device
        }
        t={t}
      />
    ));

    expect(screen.getByText('0.0.1')).toBeInTheDocument();
    expect(screen.getByText('Legacy player')).toBeInTheDocument();
    expect(screen.getAllByText('N/A')).toHaveLength(7);
  });

  it('shows the hardware details reported by the player', () => {
    render(() => (
      <DeviceInfo
        device={
          {
            ...device,
            info: {
              ...device.info,
              cpu: 'Intel N100 (4 cores)',
              memory: '8 GB',
              gpu: 'Mesa Intel(R) Graphics (ADL-N)',
              graphicsAcceleration: 'hardware',
              videoDecoding: ['H.264', 'HEVC', 'VP9', 'AV1'],
              display: 'HDMI-A-1, 3840 × 2160, 60 Hz',
            },
          } as Device
        }
        t={t}
      />
    ));

    for (const value of [
      'Intel N100 (4 cores)',
      '8 GB',
      'Mesa Intel(R) Graphics (ADL-N)',
      'Hardware (GPU)',
      'H.264, HEVC, VP9, AV1',
      'HDMI-A-1, 3840 × 2160, 60 Hz',
    ]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    expect(
      document.querySelector('[data-field="graphics-acceleration"]')
    ).not.toHaveClass('warning');
  });

  it('flags software rendering and lists no hardware decoding', () => {
    render(() => (
      <DeviceInfo
        device={
          {
            ...device,
            info: {
              ...device.info,
              graphicsAcceleration: 'software',
              videoDecoding: [],
            },
          } as Device
        }
        t={t}
      />
    ));

    expect(screen.getByText('Software only (CPU)')).toBeInTheDocument();
    expect(
      document.querySelector('[data-field="graphics-acceleration"]')
    ).toHaveClass('warning');
    expect(screen.getByText('None')).toBeInTheDocument();
    // Players that don't report hardware details don't show the fields.
    expect(screen.queryByText('Processor')).not.toBeInTheDocument();
  });
});
