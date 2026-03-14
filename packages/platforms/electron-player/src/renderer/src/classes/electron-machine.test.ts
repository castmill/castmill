import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ElectronMachine } from './electron-machine';

describe('ElectronMachine brightness', () => {
  let machine: ElectronMachine;
  const getBrightnessMock = vi.fn();
  const setBrightnessMock = vi.fn();

  beforeEach(() => {
    getBrightnessMock.mockReset();
    setBrightnessMock.mockReset();

    vi.stubGlobal('window', {
      api: {
        getBrightness: getBrightnessMock,
        setBrightness: setBrightnessMock,
      },
    });

    machine = new ElectronMachine();
  });

  it('returns brightness when platform supports it', async () => {
    getBrightnessMock.mockResolvedValue(58);

    await expect(machine.getBrightness()).resolves.toBe(58);
    expect(getBrightnessMock).toHaveBeenCalled();
  });

  it('throws when brightness is not supported', async () => {
    getBrightnessMock.mockResolvedValue(null);

    await expect(machine.getBrightness()).rejects.toThrow(
      'Brightness control not supported on this platform'
    );
  });

  it('delegates setBrightness to preload API', async () => {
    setBrightnessMock.mockResolvedValue(undefined);

    await machine.setBrightness(42);

    expect(setBrightnessMock).toHaveBeenCalledWith(42);
  });
});
