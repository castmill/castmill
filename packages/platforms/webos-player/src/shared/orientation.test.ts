import { describe, expect, it, vi } from 'vitest';
import {
  applyWebosOrientation,
  setWebosNativeOrientation,
  toNativePortrait,
} from './orientation';

describe('WebOS content orientation policy', () => {
  it.each([0, 90, 180, 270] as const)(
    'maps %i to the Custom native portrait API',
    async (angle) => {
      const api = {
        getNativePortraitMode: vi
          .fn()
          .mockResolvedValue({ nativePortrait: angle === 0 ? '90' : 'off' }),
        setNativePortraitMode: vi.fn().mockResolvedValue(undefined),
      };
      await setWebosNativeOrientation(angle, api);
      expect(api.setNativePortraitMode).toHaveBeenCalledWith({
        nativePortrait: angle === 0 ? 'off' : String(angle),
      });
      expect(toNativePortrait(angle)).toBe(angle === 0 ? 'off' : String(angle));
    }
  );
  it.each(['off', '0', 0, '90', 90, '180', 180, '270', 270])(
    'does not reset the already selected mode %s',
    async (current) => {
      const angle =
        current === 'off' ? 0 : (Number(current) as 0 | 90 | 180 | 270);
      const api = {
        getNativePortraitMode: vi
          .fn()
          .mockResolvedValue({ nativePortrait: current }),
        setNativePortraitMode: vi.fn(),
      };
      await setWebosNativeOrientation(angle, api);
      expect(api.setNativePortraitMode).not.toHaveBeenCalled();
    }
  );
  it.each([undefined, null, '45', false])(
    'rejects invalid native readback %s',
    async (value) => {
      const api = {
        getNativePortraitMode: vi
          .fn()
          .mockResolvedValue({ nativePortrait: value }),
        setNativePortraitMode: vi.fn(),
      };
      await expect(setWebosNativeOrientation(90, api)).rejects.toThrow(
        'Invalid WebOS'
      );
      expect(api.setNativePortraitMode).not.toHaveBeenCalled();
    }
  );
  it('propagates native read and write errors', async () => {
    const api = {
      getNativePortraitMode: vi
        .fn()
        .mockRejectedValue(new Error('read denied')),
      setNativePortraitMode: vi
        .fn()
        .mockRejectedValue(new Error('write denied')),
    };
    await expect(setWebosNativeOrientation(90, api)).rejects.toThrow(
      'read denied'
    );
    api.getNativePortraitMode.mockResolvedValue({ nativePortrait: 'off' });
    await expect(setWebosNativeOrientation(90, api)).rejects.toThrow(
      'write denied'
    );
  });
  it.each([0, 90, 180, 270] as const)(
    'selects CSS for %i without verified native support',
    async (angle) => {
      expect(await applyWebosOrientation(angle)).toEqual({ mode: 'css' });
    }
  );

  it('uses an explicitly supplied verified native content API', async () => {
    const native = vi.fn().mockResolvedValue(undefined);
    expect(await applyWebosOrientation(90, native)).toEqual({ mode: 'native' });
    expect(native).toHaveBeenCalledWith(90);
  });

  it('does not silently turn an unexpected native failure into CSS success', async () => {
    await expect(
      applyWebosOrientation(270, async () => {
        throw new Error('native permission denied');
      })
    ).rejects.toThrow('native permission denied');
  });
});
