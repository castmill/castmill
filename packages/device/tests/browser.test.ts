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
  });

  it('stops waiting when the browser leaves geolocation pending', async () => {
    getCurrentPosition.mockImplementation(() => undefined);

    const location = new BrowserMachine().getLocation();
    await vi.advanceTimersByTimeAsync(5000);

    await expect(location).resolves.toBeUndefined();
  });
});
