import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getLegacyParentOrigin,
  getLegacyPlatform,
  startLegacyPerformanceDiagnostics,
} from './player-frame';

describe('legacy playback performance diagnostics', () => {
  let stop: (() => void) | undefined;

  afterEach(() => {
    stop?.();
    stop = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.textContent = '';
  });

  const setup = () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let now = 0;
    let frame: FrameRequestCallback;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frame = callback;
        return 1;
      })
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    stop = startLegacyPerformanceDiagnostics();
    return {
      log,
      tick(time: number) {
        now = time;
        frame(time);
        vi.advanceTimersByTime(100);
      },
    };
  };

  it('detects animation and event-loop stalls and cleans up its probes', () => {
    const probe = setup();
    probe.tick(3100);
    expect(probe.log).toHaveBeenCalledWith(
      expect.stringContaining('animation frame gap=3100ms')
    );
    expect(probe.log).toHaveBeenCalledWith(
      expect.stringContaining('event loop gap=3100ms')
    );
    stop?.();
    stop = undefined;
    expect(vi.getTimerCount()).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it('distinguishes an unchanged overlay from a blocked event loop', () => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-castmill-debug-overlay', '');
    overlay.style.display = 'block';
    overlay.textContent = '1.0s';
    document.body.appendChild(overlay);
    const probe = setup();
    for (let now = 100; now <= 3000; now += 100) probe.tick(now);
    overlay.textContent = '0.9s';
    probe.tick(3100);
    expect(probe.log).toHaveBeenCalledWith(
      expect.stringContaining('overlay held=3000ms eventLoopStalled=false')
    );
    expect(probe.log).not.toHaveBeenCalledWith(
      expect.stringContaining('event loop gap=')
    );
  });
});

describe('getLegacyParentOrigin', () => {
  it('uses the parent window origin from document.referrer', () => {
    expect(
      getLegacyParentOrigin(
        'https://wrapper.castmill.test/player?device=42',
        'https://server.castmill.test'
      )
    ).toBe('https://wrapper.castmill.test');
  });

  describe('getLegacyPlatform', () => {
    it('identifies both spellings used by WebOS user agents', () => {
      expect(getLegacyPlatform('Mozilla/5.0 (Web0S; Linux/SmartTV)')).toBe(
        'webos'
      );
      expect(getLegacyPlatform('Mozilla/5.0 (webOS; Linux/SmartTV)')).toBe(
        'webos'
      );
    });

    it('preserves the existing Android and Electron integrations', () => {
      expect(getLegacyPlatform('Mozilla/5.0 (Android 5.1)')).toBe('android');
      expect(getLegacyPlatform('Mozilla/5.0 Electron/29')).toBe('electron');
    });
  });

  it('accepts opaque file origins reported as null', () => {
    expect(
      getLegacyParentOrigin(
        'file:///android_asset/www/index.html',
        'https://server.castmill.test'
      )
    ).toBe('null');
  });

  it('falls back to the current location origin when referrer is unavailable', () => {
    expect(getLegacyParentOrigin('', 'https://server.castmill.test')).toBe(
      'https://server.castmill.test'
    );
  });
});
