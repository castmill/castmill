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
      expect(screen.getByDisplayValue(value)).toBeInTheDocument();
    }
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

    expect(screen.getByDisplayValue('0.0.1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Legacy player')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('N/A')).toHaveLength(8);
  });
});
