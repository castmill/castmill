import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_STARTUP_RETRY_DELAY_MS,
  SCAP_READY_TIMEOUT_MS,
  STARTUP_RETRY_STEP_MS,
  bootstrap,
  resetStartupRetry,
  scheduleStartupRetry,
  showBootError,
  waitForScap,
} from '.';

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  document.body.innerHTML =
    '<div id="webos-boot"><div></div></div><div id="root"></div>';
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.castmillScapReady;
});

describe('waitForScap', () => {
  it('rejects when the SCAP loader did not run', async () => {
    await expect(waitForScap()).rejects.toThrow('SCAP loader is not available');
  });

  it('resolves when every SCAP library has loaded', async () => {
    window.castmillScapReady = Promise.resolve();
    await expect(waitForScap()).resolves.toBeUndefined();
  });

  it.each([
    [new Error('Failed to load SCAP library x.js'), 'x.js'],
    ['broken', 'broken'],
  ])('rejects with the loader failure %#', async (failure, message) => {
    window.castmillScapReady = Promise.reject(failure);
    await expect(waitForScap()).rejects.toThrow(message);
  });

  it('times out when SCAP never finishes loading', async () => {
    window.castmillScapReady = new Promise(() => {});
    const ready = waitForScap();
    const assertion = expect(ready).rejects.toThrow('Timed out');
    await vi.advanceTimersByTimeAsync(SCAP_READY_TIMEOUT_MS);
    await assertion;
  });
});

describe('startup retry', () => {
  it('backs off by one minute per failure up to nine minutes', () => {
    const reload = vi.fn();
    const delays = Array.from({ length: 11 }, () =>
      scheduleStartupRetry(reload)
    );
    expect(delays.slice(0, 3)).toEqual([
      STARTUP_RETRY_STEP_MS,
      2 * STARTUP_RETRY_STEP_MS,
      3 * STARTUP_RETRY_STEP_MS,
    ]);
    expect(delays[10]).toBe(MAX_STARTUP_RETRY_DELAY_MS);
    vi.advanceTimersByTime(STARTUP_RETRY_STEP_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('starts over after a successful startup', () => {
    const reload = vi.fn();
    scheduleStartupRetry(reload);
    scheduleStartupRetry(reload);
    resetStartupRetry();
    expect(scheduleStartupRetry(reload)).toBe(STARTUP_RETRY_STEP_MS);
  });

  it('ignores corrupt counters', () => {
    sessionStorage.setItem('castmill-webos-startup-retries', 'nope');
    expect(scheduleStartupRetry(vi.fn())).toBe(STARTUP_RETRY_STEP_MS);
  });

  it('still retries when sessionStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const reload = vi.fn();
    expect(scheduleStartupRetry(reload)).toBe(STARTUP_RETRY_STEP_MS);
    expect(() => resetStartupRetry()).not.toThrow();
    vi.advanceTimersByTime(STARTUP_RETRY_STEP_MS);
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe('bootstrap', () => {
  it('imports and starts the app only after SCAP is ready', async () => {
    let scapLoaded!: () => void;
    window.castmillScapReady = new Promise((resolve) => {
      scapLoaded = resolve;
    });
    const start = vi.fn();
    const loadApp = vi.fn(async () => ({ start }));

    const boot = bootstrap(loadApp);
    await vi.advanceTimersByTimeAsync(0);
    expect(loadApp).not.toHaveBeenCalled();

    scapLoaded();
    await boot;
    expect(start).toHaveBeenCalledWith(document.getElementById('root'));
  });

  it('shows the failure and schedules a retry', async () => {
    window.castmillScapReady = Promise.reject(new Error('SCAP missing'));
    const loadApp = vi.fn();
    await bootstrap(loadApp);

    const boot = document.getElementById('webos-boot')!;
    expect(loadApp).not.toHaveBeenCalled();
    expect(boot.getAttribute('role')).toBe('alert');
    expect(boot.textContent).toBe('SCAP missing');
    expect(sessionStorage.getItem('castmill-webos-startup-retries')).toBe('1');
  });

  it('fails without a root element', async () => {
    document.getElementById('root')!.remove();
    window.castmillScapReady = Promise.resolve();
    await bootstrap(vi.fn());
    expect(document.getElementById('webos-boot')!.textContent).toBe(
      'Root element not found.'
    );
  });

  it('shows non-Error failures and tolerates a missing boot element', () => {
    showBootError('plain failure');
    expect(document.getElementById('webos-boot')!.textContent).toBe(
      'plain failure'
    );
    document.getElementById('webos-boot')!.remove();
    expect(() => showBootError(new Error('x'))).not.toThrow();
  });
});
