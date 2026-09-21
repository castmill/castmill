import { describe, expect, it, vi } from 'vitest';
import { DeviceErrorReporter, ERROR_REPORT_LIMITS } from './error-reporter';

class TestStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('DeviceErrorReporter', () => {
  it('aggregates and sanitizes repeated errors before persistence', async () => {
    const storage = new TestStorage();
    const reporter = new DeviceErrorReporter(storage);
    await reporter.init('device-1');

    const error = new Error(
      'Failed https://media.example/file.mp4?token=secret'
    );

    reporter.report({
      category: 'media-load',
      error,
      context: { mediaId: 12, appVersion: '1.2.3' },
    });
    reporter.report({
      category: 'media-load',
      error,
      context: { mediaId: 12, appVersion: '1.2.3' },
    });
    await reporter.close();

    const buffer = JSON.parse(
      storage.getItem('castmill.device-error-buffer:device-1')!
    );
    expect(buffer.reports).toHaveLength(1);
    expect(buffer.reports[0].count).toBe(2);
    expect(buffer.reports[0].message).not.toContain('secret');
    expect(buffer.reports[0].context).toEqual({
      mediaId: '12',
      appVersion: '1.2.3',
    });
  });

  it('evicts the least-recent reports and records their quantity at the hard cap', async () => {
    vi.useFakeTimers();
    try {
      const storage = new TestStorage();
      const reporter = new DeviceErrorReporter(storage);
      await reporter.init('device-1');

      for (let index = 0; index <= ERROR_REPORT_LIMITS.maxReports; index += 1) {
        reporter.report({
          category: 'runtime',
          error: `Failure ${index}`,
        });
        vi.advanceTimersByTime(
          60_000 / ERROR_REPORT_LIMITS.maxReportsPerMinute
        );
      }
      await reporter.close();

      const buffer = JSON.parse(
        storage.getItem('castmill.device-error-buffer:device-1')!
      );
      expect(buffer.reports).toHaveLength(ERROR_REPORT_LIMITS.maxReports);
      expect(buffer.droppedCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('counts occurrences that exceed the client processing rate as overflow', async () => {
    const storage = new TestStorage();
    const reporter = new DeviceErrorReporter(storage);
    await reporter.init('device-1');

    for (let index = 0; index <= ERROR_REPORT_LIMITS.reportBurst; index += 1) {
      reporter.report({ category: 'runtime', error: 'Repeating failure' });
    }
    await reporter.close();

    const buffer = JSON.parse(
      storage.getItem('castmill.device-error-buffer:device-1')!
    );
    expect(buffer.reports).toHaveLength(1);
    expect(buffer.reports[0].count).toBe(ERROR_REPORT_LIMITS.reportBurst);
    expect(buffer.droppedCount).toBe(1);
  });

  it('keeps Unicode error text within the backend byte limit', async () => {
    const storage = new TestStorage();
    const reporter = new DeviceErrorReporter(storage);
    await reporter.init('device-1');

    reporter.report({
      category: 'runtime',
      error: '🙂'.repeat(ERROR_REPORT_LIMITS.maxMessageLength),
    });
    await reporter.close();

    const buffer = JSON.parse(
      storage.getItem('castmill.device-error-buffer:device-1')!
    );
    expect(
      new TextEncoder().encode(buffer.reports[0].message).length
    ).toBeLessThanOrEqual(ERROR_REPORT_LIMITS.maxMessageLength);
  });

  it('normalizes legacy persisted Unicode text before delivery', async () => {
    const storage = new TestStorage();
    storage.setItem(
      'castmill.device-error-buffer:device-1',
      JSON.stringify({
        version: 1,
        reports: [
          {
            report_id: 'legacy-report',
            fingerprint: 'legacy-runtime',
            category: 'runtime',
            message: 'bäckasiner '.repeat(150),
            stack: 'bäckasiner '.repeat(600),
            count: 1,
            firstOccurredAtMs: Date.now(),
            lastOccurredAtMs: Date.now(),
            first_occurred_at: new Date().toISOString(),
            last_occurred_at: new Date().toISOString(),
          },
        ],
        droppedCount: 0,
      })
    );
    const reporter = new DeviceErrorReporter(storage);
    await reporter.init('device-1');
    await reporter.close();

    const buffer = JSON.parse(
      storage.getItem('castmill.device-error-buffer:device-1')!
    );
    expect(
      new TextEncoder().encode(buffer.reports[0].message).length
    ).toBeLessThanOrEqual(ERROR_REPORT_LIMITS.maxMessageLength);
    expect(
      new TextEncoder().encode(buffer.reports[0].stack).length
    ).toBeLessThanOrEqual(ERROR_REPORT_LIMITS.maxStackLength);
  });

  it('reports global runtime errors without duplicating browser console output', async () => {
    const storage = new TestStorage();
    const reporter = new DeviceErrorReporter(storage);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Unexpected runtime failure');

    try {
      await reporter.init('device-1');
      window.dispatchEvent(new ErrorEvent('error', { error }));

      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      await reporter.close();
      errorSpy.mockRestore();
    }
  });

  it('captures global runtime errors before device identity is initialized', async () => {
    const storage = new TestStorage();
    const reporter = new DeviceErrorReporter(storage);
    const error = new Error('Early runtime failure');

    reporter.enableRuntimeCapture();
    window.dispatchEvent(new ErrorEvent('error', { error }));
    await reporter.init('device-1');
    await reporter.close();

    const buffer = JSON.parse(
      storage.getItem('castmill.device-error-buffer:device-1')!
    );
    expect(buffer.reports[0].message).toBe(error.message);
  });

  it('reports errors received through the legacy window.onerror fallback', async () => {
    const storage = new TestStorage();
    const reporter = new DeviceErrorReporter(storage);
    const previousHandler = window.onerror;
    const existingHandler = vi.fn(() => false);
    const error = new Error('Fallback runtime failure');

    window.onerror = existingHandler;

    try {
      await reporter.init('device-1');
      window.onerror?.call(window, error.message, '', 0, 0, error);

      expect(existingHandler).toHaveBeenCalledWith(
        error.message,
        '',
        0,
        0,
        error
      );
      await reporter.close();

      const buffer = JSON.parse(
        storage.getItem('castmill.device-error-buffer:device-1')!
      );
      expect(buffer.reports[0].message).toBe(error.message);
      expect(window.onerror).toBe(existingHandler);
    } finally {
      window.onerror = previousHandler;
    }
  });

  it('removes buffered reports only after an acknowledged batch', async () => {
    const storage = new TestStorage();
    const reporter = new DeviceErrorReporter(storage);
    await reporter.init('device-1');
    reporter.report({ category: 'device', error: new Error('Device failure') });

    const receive = vi.fn((status: string, callback: () => void) => {
      if (status === 'ok') {
        callback();
      }
      return { receive };
    });
    const channel = {
      push: vi.fn(() => ({ receive })),
    };

    reporter.attach(channel as any);
    await reporter.close();

    expect(channel.push).toHaveBeenCalledWith(
      'errors:report',
      expect.objectContaining({ reports: expect.any(Array), dropped_count: 0 })
    );
    expect(
      JSON.parse(storage.getItem('castmill.device-error-buffer:device-1')!)
        .reports
    ).toEqual([]);
  });

  it('resends an in-flight batch when attaching a replacement channel', async () => {
    const storage = new TestStorage();
    const reporter = new DeviceErrorReporter(storage);
    await reporter.init('device-1');
    reporter.report({ category: 'device', error: 'Delivery failure' });

    const pendingResponse = {
      receive: vi.fn(() => pendingResponse),
    };
    const initialChannel = {
      push: vi.fn(() => pendingResponse),
    };
    const replacementResponse = {
      receive: vi.fn((status: string, callback: () => void) => {
        if (status === 'ok') {
          callback();
        }
        return replacementResponse;
      }),
    };
    const replacementChannel = {
      push: vi.fn(() => replacementResponse),
    };

    reporter.attach(initialChannel as any);
    reporter.attach(replacementChannel as any);
    await reporter.close();

    expect(initialChannel.push).toHaveBeenCalledOnce();
    expect(replacementChannel.push).toHaveBeenCalledWith(
      'errors:report',
      expect.objectContaining({
        reports: expect.arrayContaining([
          expect.objectContaining({
            report_id:
              initialChannel.push.mock.calls[0][1].reports[0].report_id,
          }),
        ]),
      })
    );
    expect(
      JSON.parse(storage.getItem('castmill.device-error-buffer:device-1')!)
        .reports
    ).toEqual([]);
  });

  it('sends the first error after an idle channel join immediately', async () => {
    const storage = new TestStorage();
    const reporter = new DeviceErrorReporter(storage);
    await reporter.init('device-1');

    const receive = vi.fn((status: string, callback: () => void) => {
      if (status === 'ok') {
        callback();
      }
      return { receive };
    });
    const channel = {
      push: vi.fn(() => ({ receive })),
    };

    reporter.attach(channel as any);
    reporter.report({ category: 'playback', error: 'Video playback failed' });

    expect(channel.push).toHaveBeenCalledTimes(1);
    await reporter.close();
  });

  it('delivers sparse errors one second after the initial flush', async () => {
    vi.useFakeTimers();
    try {
      const storage = new TestStorage();
      const reporter = new DeviceErrorReporter(storage);
      await reporter.init('device-1');
      reporter.report({ category: 'device', error: 'First failure' });

      const receive = vi.fn((status: string, callback: () => void) => {
        if (status === 'ok') {
          callback();
        }
        return { receive };
      });
      const channel = {
        push: vi.fn(() => ({ receive })),
      };

      reporter.attach(channel as any);
      reporter.report({ category: 'device', error: 'Second failure' });

      expect(channel.push).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(ERROR_REPORT_LIMITS.lowPressureFlushIntervalMs);
      expect(channel.push).toHaveBeenCalledTimes(2);
      await reporter.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('increases the delivery window while errors are arriving quickly', async () => {
    vi.useFakeTimers();
    try {
      const storage = new TestStorage();
      const reporter = new DeviceErrorReporter(storage);
      await reporter.init('device-1');

      const receive = vi.fn((status: string, callback: () => void) => {
        if (status === 'ok') {
          callback();
        }
        return { receive };
      });
      const channel = {
        push: vi.fn(() => ({ receive })),
      };

      reporter.attach(channel as any);
      for (let index = 0; index < 6; index += 1) {
        reporter.report({ category: 'device', error: `Failure ${index}` });
      }

      expect(channel.push).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(ERROR_REPORT_LIMITS.lowPressureFlushIntervalMs);
      expect(channel.push).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(
        ERROR_REPORT_LIMITS.mediumPressureFlushIntervalMs -
          ERROR_REPORT_LIMITS.lowPressureFlushIntervalMs
      );
      expect(channel.push).toHaveBeenCalledTimes(2);
      await reporter.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the high-pressure window after more than 20 reports per minute', async () => {
    vi.useFakeTimers();
    try {
      const storage = new TestStorage();
      const reporter = new DeviceErrorReporter(storage);
      await reporter.init('device-1');

      const receive = vi.fn((status: string, callback: () => void) => {
        if (status === 'ok') {
          callback();
        }
        return { receive };
      });
      const channel = {
        push: vi.fn(() => ({ receive })),
      };

      reporter.attach(channel as any);
      for (let index = 0; index < 20; index += 1) {
        reporter.report({ category: 'device', error: `Failure ${index}` });
      }
      vi.advanceTimersByTime(500);
      reporter.report({ category: 'device', error: 'Failure 20' });

      vi.advanceTimersByTime(ERROR_REPORT_LIMITS.mediumPressureFlushIntervalMs);
      expect(channel.push).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(
        ERROR_REPORT_LIMITS.highPressureFlushIntervalMs -
          ERROR_REPORT_LIMITS.mediumPressureFlushIntervalMs
      );
      expect(channel.push).toHaveBeenCalledTimes(2);
      await reporter.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries a timed-out batch with its original report ID', async () => {
    vi.useFakeTimers();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const storage = new TestStorage();
      const reporter = new DeviceErrorReporter(storage);
      await reporter.init('device-1');
      reporter.report({ category: 'device', error: 'Delivery failure' });

      let attempt = 0;
      const channel = {
        push: vi.fn(() => {
          const result = attempt === 0 ? 'error' : 'ok';
          attempt += 1;
          const response = {
            receive: (status: string, callback: () => void) => {
              if (status === result) {
                callback();
              }
              return response;
            },
          };
          return response;
        }),
      };

      reporter.attach(channel as any);
      vi.advanceTimersByTime(ERROR_REPORT_LIMITS.retryBaseMs);

      expect(channel.push).toHaveBeenCalledTimes(2);
      expect(channel.push.mock.calls[1][1].reports[0].report_id).toBe(
        channel.push.mock.calls[0][1].reports[0].report_id
      );
      await reporter.close();
    } finally {
      random.mockRestore();
      vi.useRealTimers();
    }
  });
});
