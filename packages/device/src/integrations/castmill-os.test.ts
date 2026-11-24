import { describe, expect, it, vi } from 'vitest';
import {
  CastmillOSMachine,
  getCastmillOSBridge,
  pickHardwareInfo,
  type CastmillOSBridge,
} from './castmill-os';

function fakeBridge(results: Record<string, unknown> = {}) {
  const call = vi.fn(async (method: string, ..._args: unknown[]) =>
    method in results ? results[method] : null
  );
  const bridge: CastmillOSBridge = { version: 1, call };
  return { bridge, call };
}

describe('getCastmillOSBridge', () => {
  it('returns the bridge exposed by the Castmill OS kiosk shell', () => {
    const { bridge } = fakeBridge();
    expect(getCastmillOSBridge({ castmillOS: bridge })).toBe(bridge);
  });

  it('accepts newer, backwards compatible bridge versions', () => {
    const { bridge } = fakeBridge();
    const v2 = { ...bridge, version: 2 };
    expect(getCastmillOSBridge({ castmillOS: v2 })).toBe(v2);
  });

  it('ignores missing or malformed bridges', () => {
    expect(getCastmillOSBridge({})).toBeUndefined();
    expect(getCastmillOSBridge({ castmillOS: {} })).toBeUndefined();
    expect(
      getCastmillOSBridge({ castmillOS: { version: 0, call: () => {} } })
    ).toBeUndefined();
    expect(
      getCastmillOSBridge({ castmillOS: { version: '1', call: () => {} } })
    ).toBeUndefined();
  });

  it('finds no bridge in a plain browser', () => {
    expect(getCastmillOSBridge()).toBeUndefined();
  });
});

describe('CastmillOSMachine', () => {
  it('stores settings and credentials through the bridge', async () => {
    const { bridge, call } = fakeBridge({
      getSetting: 'https://castmill.net',
      getCredentials: '{"device":{"id":"d1"}}',
    });
    const machine = new CastmillOSMachine(bridge);

    expect(await machine.getSetting('BASE_URL')).toBe('https://castmill.net');
    await machine.setSetting('ORIENTATION', '90');
    await machine.storeCredentials('{"device":{"id":"d1"}}');
    expect(await machine.getCredentials()).toBe('{"device":{"id":"d1"}}');
    await machine.removeCredentials();

    expect(call.mock.calls).toEqual([
      ['getSetting', 'BASE_URL'],
      ['setSetting', 'ORIENTATION', '90'],
      ['storeCredentials', '{"device":{"id":"d1"}}'],
      ['getCredentials'],
      ['removeCredentials'],
    ]);
  });

  it('reports OS facts from Castmill OS and adds the user agent', async () => {
    const telemetry = { uptimeSeconds: 42, cpuUsagePercent: 12.5 };
    const { bridge } = fakeBridge({
      getMachineGUID: '0123abcd-HDMI-A-1',
      getTimezone: 'Europe/Stockholm',
      getTelemetry: telemetry,
      getDeviceInfo: {
        appType: 'Castmill OS',
        appVersion: '0.1.0',
        os: 'Castmill OS 0.1.0',
        hardware: 'Intel NUC',
        environmentVersion: 'Electron 45.4.1',
      },
    });
    const machine = new CastmillOSMachine(bridge);

    expect(await machine.getMachineGUID()).toBe('0123abcd-HDMI-A-1');
    expect(await machine.getTimezone()).toBe('Europe/Stockholm');
    expect(await machine.getTelemetry()).toEqual(telemetry);
    expect(await machine.getDeviceInfo()).toEqual({
      appType: 'Castmill OS',
      appVersion: '0.1.0',
      os: 'Castmill OS 0.1.0',
      hardware: 'Intel NUC',
      environmentVersion: 'Electron 45.4.1',
      userAgent: navigator.userAgent,
    });
  });

  it('adds the hardware details to the device info', async () => {
    const { bridge } = fakeBridge({
      getDeviceInfo: {
        appType: 'Castmill OS',
        appVersion: '0.2.0',
        os: 'Castmill OS 0.2.0',
        hardware: 'Intel NUC',
      },
      getHardwareInfo: {
        cpu: 'Intel N100 (4 cores)',
        memory: '8 GB',
        gpu: 'Mesa Intel(R) Graphics (ADL-N)',
        graphicsAcceleration: 'hardware',
        videoDecoding: ['H.264', 'HEVC', 'VP9', 'AV1'],
        display: 'HDMI-A-1, 3840 × 2160, 60 Hz',
      },
    });
    const machine = new CastmillOSMachine(bridge);

    expect(await machine.getDeviceInfo()).toEqual({
      appType: 'Castmill OS',
      appVersion: '0.2.0',
      os: 'Castmill OS 0.2.0',
      hardware: 'Intel NUC',
      cpu: 'Intel N100 (4 cores)',
      memory: '8 GB',
      gpu: 'Mesa Intel(R) Graphics (ADL-N)',
      graphicsAcceleration: 'hardware',
      videoDecoding: ['H.264', 'HEVC', 'VP9', 'AV1'],
      display: 'HDMI-A-1, 3840 × 2160, 60 Hz',
      userAgent: navigator.userAgent,
    });
  });

  it('works with Castmill OS versions without hardware details', async () => {
    const info = {
      appType: 'Castmill OS',
      appVersion: '0.1.0',
      os: 'Castmill OS 0.1.0',
      hardware: 'Intel NUC',
    };
    const call = vi.fn(async (method: string) => {
      if (method === 'getHardwareInfo') {
        throw new Error('castmillOS: unknown method getHardwareInfo');
      }
      return info;
    });
    const machine = new CastmillOSMachine({ version: 1, call });

    expect(await machine.getDeviceInfo()).toEqual({
      ...info,
      userAgent: navigator.userAgent,
    });
  });

  it('has the methods the device calls unconditionally while registering', async () => {
    const { bridge, call } = fakeBridge({ getTimezone: 'Europe/Madrid' });
    const machine = new CastmillOSMachine(bridge);

    // Device.requestPincode and the registration recovery watcher call these
    // without checking that they exist.
    expect(await machine.getLocation()).toBeUndefined();
    expect(await machine.getTimezone()).toBe('Europe/Madrid');
    await machine.storeCredentials('{}');
    expect(call.mock.calls).toEqual([
      ['getTimezone'],
      ['storeCredentials', '{}'],
    ]);
  });

  it('forwards restart, reboot and cache clearing', async () => {
    const { bridge, call } = fakeBridge();
    const machine = new CastmillOSMachine(bridge);
    await machine.restart();
    await machine.reboot();
    await machine.clearCache();
    expect(call.mock.calls).toEqual([['restart'], ['reboot'], ['clearCache']]);
  });

  it('propagates bridge errors', async () => {
    const bridge: CastmillOSBridge = {
      version: 1,
      call: async () => {
        throw new Error('reboot not available');
      },
    };
    await expect(new CastmillOSMachine(bridge).reboot()).rejects.toThrow(
      'reboot not available'
    );
  });

  it('does not offer shutdown, app or firmware updates, or native rotation', () => {
    const machine = new CastmillOSMachine(fakeBridge().bridge) as Record<
      string,
      unknown
    >;
    expect(machine.shutdown).toBeUndefined();
    expect(machine.update).toBeUndefined();
    expect(machine.updateFirmware).toBeUndefined();
    expect(machine.setOrientation).toBeUndefined();
  });
});

describe('pickHardwareInfo', () => {
  it('keeps only known fields with the right types', () => {
    expect(
      pickHardwareInfo({
        cpu: 'Cortex-A76 (4 cores)',
        memory: '',
        gpu: 42,
        graphicsAcceleration: 'quantum',
        videoDecoding: ['HEVC', 7, 'x'.repeat(65)],
        display: 'x'.repeat(300),
        serial: 'secret',
      })
    ).toEqual({
      cpu: 'Cortex-A76 (4 cores)',
      videoDecoding: ['HEVC'],
      display: 'x'.repeat(200),
    });
    expect(pickHardwareInfo(null)).toEqual({});
    expect(pickHardwareInfo('cpu')).toEqual({});
  });
});

describe('CastmillOSMachine OS updates', () => {
  it('passes the target to the kiosk shell and reads the status back', async () => {
    const status = {
      compatible: 'castmill-os-raspberrypi5',
      state: 'installing',
      progress: 30,
    };
    const { bridge, call } = fakeBridge({ getOsUpdateStatus: status });
    const machine = new CastmillOSMachine(bridge);
    const target = { version: '0.3.0', url: 'https://example.com/b.raucb' };

    await machine.setOsUpdate(target);
    expect(await machine.getOsUpdateStatus()).toEqual(status);
    expect(call.mock.calls).toEqual([
      ['setOsUpdate', target],
      ['getOsUpdateStatus'],
    ]);
  });

  it('has no status on Castmill OS versions without OS updates', async () => {
    const call = vi.fn(async () => {
      throw new Error('castmillOS: unknown method getOsUpdateStatus');
    });
    const machine = new CastmillOSMachine({ version: 1, call });
    expect(await machine.getOsUpdateStatus()).toBeUndefined();

    const { bridge } = fakeBridge({ getOsUpdateStatus: { state: 'idle' } });
    expect(
      await new CastmillOSMachine(bridge).getOsUpdateStatus()
    ).toBeUndefined();
  });
});
