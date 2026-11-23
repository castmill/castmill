import { describe, expect, it, vi } from 'vitest';
import {
  CastmillOSMachine,
  getCastmillOSBridge,
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
