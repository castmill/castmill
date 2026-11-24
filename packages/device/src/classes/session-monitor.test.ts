import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceSessionMonitor } from './session-monitor';

const key = 'castmill.device-session:device-1';

describe('device session crash recovery', () => {
  const monitors: DeviceSessionMonitor[] = [];
  const start = (deviceId = 'device-1', storage = window.localStorage) => {
    const report = vi.fn();
    const monitor = new DeviceSessionMonitor(storage, deviceId, report);
    monitors.push(monitor);
    return { monitor, report };
  };
  const saved = () => JSON.parse(window.localStorage.getItem(key)!);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T10:00:00Z'));
    window.localStorage.clear();
  });
  afterEach(() => {
    monitors.splice(0).forEach((monitor) => monitor.stop());
    window.localStorage.clear();
    document.body.textContent = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('checkpoints bounded template and image diagnostics without reading media URLs', () => {
    document.body.innerHTML = `
      <div data-component="template" data-name="Bjurfors">
        <div data-component="image" style="background-image:url(https://media.test/image?token=secret)"></div>
        <div data-component="image"></div>
      </div>`;
    vi.stubGlobal('performance', {
      memory: { usedJSHeapSize: 64 * 1024 * 1024 },
    });
    const { report } = start();
    const initial = saved();
    expect(initial.active).toBe(true);
    expect(initial.diagnostics).toContain('Bjurfors');
    expect(initial.diagnostics).toContain('Image backgrounds: 1/2');
    expect(initial.diagnostics).toContain('64 MiB');
    expect(JSON.stringify(initial)).not.toContain('secret');
    expect(report).not.toHaveBeenCalled();

    document
      .querySelector('[data-component="template"]')!
      .setAttribute('data-name', 'Next listing');
    vi.advanceTimersByTime(15_000);
    expect(saved().lastSeenAt - initial.lastSeenAt).toBe(15_000);
    expect(saved().diagnostics).toContain('Next listing');
    for (let index = 0; index < 30; index++) {
      const element = document.createElement('div');
      element.setAttribute('data-component', 'template');
      element.setAttribute('data-name', 'Long template '.repeat(100));
      document.body.appendChild(element);
    }
    vi.advanceTimersByTime(15_000);
    expect(saved().diagnostics.length).toBeLessThan(768);
    expect(window.localStorage.getItem(key)!.length).toBeLessThan(2048);
  });

  it('reports an interrupted session once, scoped to the same device', () => {
    const first = start();
    vi.advanceTimersByTime(30_000);
    const interrupted = window.localStorage.getItem(key)!;
    first.monitor.stop();
    window.localStorage.setItem(key, interrupted);
    expect(start('other-device').report).not.toHaveBeenCalled();

    const recovered = start();
    expect(recovered.report).toHaveBeenCalledOnce();
    expect(recovered.report).toHaveBeenCalledWith({
      category: 'runtime',
      code: 'player-unclean-exit',
      error: expect.stringContaining('2026-11-24T10:00:30.000Z'),
    });
    expect(recovered.report.mock.calls[0][0].error).toContain('power loss');
    recovered.monitor.stop();
    expect(start().report).not.toHaveBeenCalled();
  });

  it.each(['beforeunload', 'pagehide'])(
    'does not report a normal %s or BFCache restoration as a crash',
    (event) => {
      const first = start();
      window.dispatchEvent(new Event(event));
      vi.advanceTimersByTime(90_000);
      expect(saved().active).toBe(false);
      expect(start().report).not.toHaveBeenCalled();
      first.monitor.stop();
      window.dispatchEvent(new Event('pageshow'));
      expect(saved().active).toBe(true);
    }
  );

  it('allows delayed native maintenance exits, then resumes detection if the page remains alive', () => {
    const { monitor } = start();
    monitor.expectExit();
    vi.advanceTimersByTime(45_000);
    expect(saved().active).toBe(false);
    vi.advanceTimersByTime(15_000);
    expect(saved().active).toBe(true);
    monitor.expectExit();
    monitor.resume();
    expect(saved().active).toBe(true);
  });

  it.each(['{bad json', JSON.stringify({ version: 2 }), 'x'.repeat(4097)])(
    'discards malformed previous markers without inventing a crash',
    (invalid) => {
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      window.localStorage.setItem(key, invalid);
      expect(start().report).not.toHaveBeenCalled();
      expect(saved().active).toBe(true);
      expect(warning).toHaveBeenCalled();
    }
  );

  it('logs storage failures once and stops checkpoint writes instead of breaking playback', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('Storage unavailable');
      }),
      setItem: vi.fn(() => {
        throw new Error('Quota exceeded');
      }),
    };
    const monitor = new DeviceSessionMonitor(storage, 'device-1', vi.fn());
    monitors.push(monitor);
    vi.advanceTimersByTime(120_000);
    monitor.expectExit();
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalledTimes(2);
  });
});
