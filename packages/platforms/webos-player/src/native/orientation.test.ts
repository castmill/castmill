import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNativePortraitApi } from './orientation';
import { WebosMachine } from '../classes/webos-machine';

vi.mock('../native', () => ({}));
vi.mock('../classes/utils', () => ({}));
vi.mock('../classes/system-monitor', () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function install(configuration: Custom['Configuration']) {
  vi.stubGlobal(
    'Custom',
    class {
      Configuration = configuration;
    }
  );
}

describe('Custom native portrait binding', () => {
  it('selects CSS only when the Custom API is absent', async () => {
    vi.stubGlobal('Custom', undefined);
    expect(getNativePortraitApi()).toBeUndefined();
    expect(await new WebosMachine().setOrientation(90)).toEqual({
      mode: 'css',
    });
    install({});
    expect(getNativePortraitApi()).toBeUndefined();
    install({ getNativePortraitMode: vi.fn() });
    expect(getNativePortraitApi()).toBeUndefined();
  });

  it.each([0, 90, 180, 270] as const)(
    'uses Custom callbacks and native mode for %i',
    async (angle) => {
      const configuration: Custom['Configuration'] = {
        getNativePortraitMode: vi.fn(function (success) {
          expect(this).toBe(configuration);
          success({ nativePortrait: angle === 0 ? '90' : 'off' });
        }),
        setNativePortraitMode: vi.fn(function (success, _failure, options) {
          expect(this).toBe(configuration);
          expect(options).toEqual({
            nativePortrait: angle === 0 ? 'off' : String(angle),
          });
          success();
        }),
      };
      install(configuration);
      expect(await new WebosMachine().setOrientation(angle)).toEqual({
        mode: 'native',
      });
      expect(configuration.setNativePortraitMode).toHaveBeenCalledOnce();
    }
  );

  it('does not hide native failure or fall back after a write error', async () => {
    const error = { errorCode: 'ACCESS_DENIED' };
    install({
      getNativePortraitMode: (success) => success({ nativePortrait: 'off' }),
      setNativePortraitMode: (_success, failure) => failure(error),
    });
    await expect(new WebosMachine().setOrientation(90)).rejects.toBe(error);
  });

  it('clears deadlines on synchronous API throws', async () => {
    vi.useFakeTimers();
    install({
      getNativePortraitMode: () => {
        throw new Error('native throw');
      },
      setNativePortraitMode: vi.fn(),
    });
    await expect(
      getNativePortraitApi()!.getNativePortraitMode()
    ).rejects.toThrow('native throw');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds stalled native reads and writes', async () => {
    vi.useFakeTimers();
    install({ getNativePortraitMode: vi.fn(), setNativePortraitMode: vi.fn() });
    const api = getNativePortraitApi()!;
    const read = expect(api.getNativePortraitMode()).rejects.toThrow(
      'timed out'
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await read;
    const write = expect(
      api.setNativePortraitMode({ nativePortrait: '270' })
    ).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(10_000);
    await write;
    expect(vi.getTimerCount()).toBe(0);
  });
});
