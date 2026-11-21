import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserMachine } from '../src/integrations/browser';

describe('BrowserMachine location', () => {
  let getCurrentPosition: ReturnType<typeof vi.fn>;
  let originalGeolocation: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    originalGeolocation = Object.getOwnPropertyDescriptor(
      navigator,
      'geolocation'
    );
    getCurrentPosition = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
  });

  afterEach(() => {
    if (originalGeolocation) {
      Object.defineProperty(navigator, 'geolocation', originalGeolocation);
    } else {
      delete (navigator as Partial<Navigator>).geolocation;
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns browser coordinates when geolocation succeeds', async () => {
    getCurrentPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 59.33,
          longitude: 18.07,
        },
      } as GeolocationPosition);
    });

    await expect(new BrowserMachine().getLocation()).resolves.toEqual({
      latitude: 59.33,
      longitude: 18.07,
    });
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({ timeout: 5000 });
    expect(vi.getTimerCount()).toBe(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('stops waiting when the browser leaves geolocation pending', async () => {
    getCurrentPosition.mockImplementation(() => undefined);

    const location = new BrowserMachine().getLocation();
    await vi.advanceTimersByTimeAsync(5000);

    await expect(location).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([1, 2, 3])(
    'continues without location after geolocation error %s',
    async (code) => {
      getCurrentPosition.mockImplementation((_success, error) =>
        error({ code })
      );

      await expect(new BrowserMachine().getLocation()).resolves.toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
      expect(console.warn).toHaveBeenCalledOnce();
    }
  );

  it('continues when the geolocation API is absent', async () => {
    delete (navigator as Partial<Navigator>).geolocation;

    await expect(new BrowserMachine().getLocation()).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('continues when geolocation throws synchronously', async () => {
    getCurrentPosition.mockImplementation(() => {
      throw new Error('Geolocation unavailable');
    });

    await expect(new BrowserMachine().getLocation()).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores callbacks arriving after the deadline', async () => {
    const location = new BrowserMachine().getLocation();
    await vi.advanceTimersByTimeAsync(5000);
    const [success, error] = getCurrentPosition.mock.calls[0];
    success({ coords: { latitude: 59.33, longitude: 18.07 } });
    error({ code: 3 });

    await expect(location).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
