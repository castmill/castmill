import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWebosVersion, resetWebosVersionCache } from './webos-version';

const stubCustom = (getwebOSVersion?: unknown) => {
  const constructed = vi.fn();
  vi.stubGlobal(
    'Custom',
    class {
      Signage = { getwebOSVersion };
      constructor() {
        constructed();
      }
    }
  );
  return constructed;
};

describe('getWebosVersion', () => {
  afterEach(() => {
    resetWebosVersionCache();
    vi.unstubAllGlobals();
  });

  it('returns undefined without custom.js', async () => {
    vi.stubGlobal('Custom', undefined);
    await expect(getWebosVersion()).resolves.toBeUndefined();
  });

  it('returns undefined when the firmware lacks the API', async () => {
    stubCustom();
    await expect(getWebosVersion()).resolves.toBeUndefined();
  });

  it('caches a successful lookup', async () => {
    const get = vi.fn((success: (value: unknown) => void) =>
      success({ webOSVersion: '4.1.0' })
    );
    stubCustom(get);
    await expect(getWebosVersion()).resolves.toBe('4.1.0');
    await expect(getWebosVersion()).resolves.toBe('4.1.0');
    expect(get).toHaveBeenCalledOnce();
  });

  it('retries after an empty result', async () => {
    const get = vi
      .fn()
      .mockImplementationOnce((success) => success({ webOSVersion: '' }))
      .mockImplementationOnce((success) => success({ webOSVersion: '3.2' }));
    stubCustom(get);
    await expect(getWebosVersion()).resolves.toBeUndefined();
    await expect(getWebosVersion()).resolves.toBe('3.2');
  });

  it('retries after a failure', async () => {
    const get = vi
      .fn()
      .mockImplementationOnce((_, failure) => failure(new Error('busy')))
      .mockImplementationOnce((success) => success({ webOSVersion: '6.0' }));
    stubCustom(get);
    await expect(getWebosVersion()).rejects.toThrow('busy');
    await expect(getWebosVersion()).resolves.toBe('6.0');
  });
});
