import { afterEach, describe, expect, it, vi } from 'vitest';
import { Device } from '../../../../device/src/classes/device';
import { ElectronLegacyMachine } from './electron-legacy-machine';
import { AndroidLegacyMachine } from './android-legacy-machine';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Legacy Electron dashboard updates', () => {
  it('publishes the update capability despite unrelated wrapper messages', async () => {
    const wrapper = document.createElement('iframe');
    document.body.append(wrapper);
    const parent = wrapper.contentWindow!;
    vi.stubGlobal('parent', parent);
    vi.spyOn(parent, 'postMessage').mockImplementation(() => {});
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetch);
    const device = Object.create(Device.prototype);
    device.integration = new ElectronLegacyMachine();
    device.baseUrl = 'https://castmill.test';
    device.logger = { error: vi.fn() };
    device.errorReporter = { report: vi.fn() };
    try {
      const pending = device.updateDeviceInfo({
        device: { id: 'device-1', token: 'test-token' },
      });
      window.dispatchEvent(
        new MessageEvent('message', {
          data: 'console',
          origin: 'app://.',
          source: parent,
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({
            deviceId: 'device-1',
            versionStr: 'Castmill-Electron-1.0.0',
            model: 'Electron',
          }),
          origin: 'app://.',
          source: parent,
        })
      );
      await pending;

      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch.mock.calls[0][0]).toBe(
        'https://castmill.test/devices/device-1/info'
      );
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
        info: {
          appType: 'Electron legacy adapter',
          capabilities: { update: true, updateFirmware: false },
        },
      });
      expect(device.errorReporter.report).not.toHaveBeenCalled();
    } finally {
      wrapper.remove();
    }
  });

  it('reports update support and forwards update_app to the wrapper', async () => {
    const machine = new ElectronLegacyMachine();
    const device = Object.create(Device.prototype);
    device.integration = machine;
    const handlers = new Map<string, (payload: unknown) => Promise<void>>();
    device.initListeners({
      on: (event: string, handler: (payload: unknown) => Promise<void>) => {
        handlers.set(event, handler);
      },
    });
    const postMessage = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => {});

    expect(device.getCapabilities()).toMatchObject({
      update: true,
      updateFirmware: false,
    });
    await handlers.get('command')!({ command: 'update_app' });

    expect(postMessage).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith('updatePlayer', '*');
  });

  it('does not add application update support to legacy Android', () => {
    const device = Object.create(Device.prototype);
    device.integration = new AndroidLegacyMachine();
    expect(device.getCapabilities().update).toBe(false);
  });
});
