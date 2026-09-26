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

  it('strips URL queries and fragments from every stack frame', async () => {
    const storage = new TestStorage();
    const reporter = new DeviceErrorReporter(storage);
    const error = new Error('Stack failure');
    error.stack = [
      'Error: Stack failure',
      'at one (https://first.example/script.js?token=first#section)',
      'at two (https://second.example/script.js?token=second#section)',
    ].join('\n');

    await reporter.init('device-1');
    reporter.report({ category: 'runtime', error });
    await reporter.close();

    const [report] = JSON.parse(
      storage.getItem('castmill.device-error-buffer:device-1')!
    ).reports;
    expect(report.stack).toContain(
      'https://first.example/script.js?[redacted])'
    );
    expect(report.stack).toContain(
      'https://second.example/script.js?[redacted])'
    );
    expect(report.stack).not.toContain('token=first');
    expect(report.stack).not.toContain('token=second');
  });

  it('keeps only runtime-whitelisted context keys', async () => {
    const storage = new TestStorage();
    const reporter = new DeviceErrorReporter(storage);
    await reporter.init('device-1');

    reporter.report({
      category: 'runtime',
      error: 'Context failure',
      context: {
        playlistId: 1,
        layerId: 'layer-1',
        layerName: 'Layer',
        widgetId: 2,
        mediaId: 3,
        appVersion: '1.0.0',
        arbitrary: 'must not be included',
        authorization: 'must not be included',
      } as any,
    });
    await reporter.close();

    const [report] = JSON.parse(
      storage.getItem('castmill.device-error-buffer:device-1')!
    ).reports;
    expect(report.context).toEqual({
      playlistId: '1',
      layerId: 'layer-1',
      layerName: 'Layer',
      widgetId: '2',
      mediaId: '3',
      appVersion: '1.0.0',
    });
  });

  it('merges matching persisted and pre-init reports without losing occurrences', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2025-01-01T00:00:02.000Z'));
      const storage = new TestStorage();
      const reporter = new DeviceErrorReporter(storage);
      reporter.report({ category: 'runtime', error: 'Startup failure' });
      const inMemory = Array.from((reporter as any).reports.values())[0];

      storage.setItem(
        'castmill.device-error-buffer:device-1',
        JSON.stringify({
          version: 1,
          reports: [
            {
              ...inMemory,
              report_id: 'persisted-report-id',
              count: 2,
              firstOccurredAtMs: Date.parse('2025-01-01T00:00:00.000Z'),
              lastOccurredAtMs: Date.parse('2025-01-01T00:00:01.000Z'),
              first_occurred_at: '2025-01-01T00:00:00.000Z',
              last_occurred_at: '2025-01-01T00:00:01.000Z',
            },
          ],
          droppedCount: 0,
        })
      );

      await reporter.init('device-1');
      await reporter.close();

      const [report] = JSON.parse(
        storage.getItem('castmill.device-error-buffer:device-1')!
      ).reports;
      expect(report).toMatchObject({
        report_id: 'persisted-report-id',
        count: 3,
        first_occurred_at: '2025-01-01T00:00:00.000Z',
        last_occurred_at: '2025-01-01T00:00:02.000Z',
      });
    } finally {
      vi.useRealTimers();
    }
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

  it('discards malformed persisted reports instead of retrying them forever', async () => {
    const storage = new TestStorage();
    const seed = new DeviceErrorReporter(storage);
    await seed.init('device-1');
    seed.report({ category: 'runtime', error: 'Valid failure' });
    await seed.close();

    const key = 'castmill.device-error-buffer:device-1';
    const buffer = JSON.parse(storage.getItem(key)!);
    const valid = buffer.reports[0];
    buffer.reports[0] = { ...valid, privateData: 'do not transmit' };
    buffer.reports.push(
      { ...valid, report_id: null, fingerprint: 'invalid-id' },
      { ...valid, category: 'unknown', fingerprint: 'invalid-category' },
      {
        ...valid,
        first_occurred_at: 'not-a-date',
        fingerprint: 'invalid-time',
      },
      {
        ...valid,
        last_occurred_at: '2025-01-01T00:00:00.000Z',
        fingerprint: 'mismatched-time',
      }
    );
    storage.setItem(key, JSON.stringify(buffer));

    const reporter = new DeviceErrorReporter(storage);
    await reporter.init('device-1');
    const response = {
      receive: vi.fn((status: string, callback: () => void) => {
        if (status === 'ok') callback();
        return response;
      }),
    };
    const channel = { push: vi.fn(() => response) };
    reporter.attach(channel as any);
    expect(channel.push.mock.calls[0][1].reports).toHaveLength(1);
    expect(channel.push.mock.calls[0][1].reports[0].report_id).toBe(
      valid.report_id
    );
    expect(channel.push.mock.calls[0][1].reports[0]).not.toHaveProperty(
      'privateData'
    );
    await reporter.close();
  });

  it('discards an invalid persisted in-flight batch without blocking queued reports', async () => {
    const storage = new TestStorage();
    const key = 'castmill.device-error-buffer:device-1';
    const seed = new DeviceErrorReporter(storage);
    await seed.init('device-1');
    seed.report({ category: 'device', error: 'Queued failure' });
    await seed.close();

    const buffer = JSON.parse(storage.getItem(key)!);
    buffer.inFlight = {
      reports: [{ ...buffer.reports[0], category: 'invalid' }],
      droppedCount: 0,
    };
    storage.setItem(key, JSON.stringify(buffer));

    const reporter = new DeviceErrorReporter(storage);
    await reporter.init('device-1');
    const response = {
      receive: vi.fn((status: string, callback: () => void) => {
        if (status === 'ok') callback();
        return response;
      }),
    };
    const channel = { push: vi.fn(() => response) };
    reporter.attach(channel as any);
    expect(channel.push).toHaveBeenCalledOnce();
    expect(channel.push.mock.calls[0][1].reports[0].message).toBe(
      'Queued failure'
    );
    await reporter.close();
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

  it('keeps aggregate IDs across reloads and rotates them for residual occurrences', async () => {
    vi.useFakeTimers();
    try {
      const storage = new TestStorage();
      const initialReporter = new DeviceErrorReporter(storage);
      await initialReporter.init('device-1');
      initialReporter.report({ category: 'device', error: 'Delivery failure' });
      await initialReporter.close();

      const persistedId = JSON.parse(
        storage.getItem('castmill.device-error-buffer:device-1')!
      ).reports[0].report_id;
      const reporter = new DeviceErrorReporter(storage);
      await reporter.init('device-1');
      let acknowledge: (() => void) | undefined;
      const response = {
        receive: vi.fn((status: string, callback: () => void) => {
          if (status === 'ok') {
            acknowledge = callback;
          }
          return response;
        }),
      };
      const channel = { push: vi.fn(() => response) };

      reporter.attach(channel as any);
      reporter.report({ category: 'device', error: 'Delivery failure' });
      acknowledge?.();
      vi.advanceTimersByTime(ERROR_REPORT_LIMITS.lowPressureFlushIntervalMs);

      expect(channel.push.mock.calls[0][1].reports[0].report_id).toBe(
        persistedId
      );
      expect(channel.push.mock.calls[1][1].reports[0]).toMatchObject({
        count: 1,
      });
      expect(channel.push.mock.calls[1][1].reports[0].report_id).not.toBe(
        persistedId
      );
      await reporter.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('persists in-flight snapshots separately from newer occurrences across reloads', async () => {
    vi.useFakeTimers();
    try {
      const storage = new TestStorage();
      const key = 'castmill.device-error-buffer:device-1';
      const reporter = new DeviceErrorReporter(storage);
      await reporter.init('device-1');
      reporter.report({ category: 'device', error: 'Repeated failure' });
      const unacknowledged = { receive: vi.fn(() => unacknowledged) };
      const firstChannel = { push: vi.fn(() => unacknowledged) };
      reporter.attach(firstChannel as any);
      const sentId = firstChannel.push.mock.calls[0][1].reports[0].report_id;

      reporter.report({ category: 'device', error: 'Repeated failure' });
      await reporter.close();
      const saved = JSON.parse(storage.getItem(key)!);
      expect(saved.inFlight.reports[0]).toMatchObject({
        report_id: sentId,
        count: 1,
      });
      expect(saved.reports[0]).toMatchObject({ count: 1 });
      expect(saved.reports[0].report_id).not.toBe(sentId);

      const reloaded = new DeviceErrorReporter(storage);
      await reloaded.init('device-1');
      const response = {
        receive: vi.fn((status: string, callback: () => void) => {
          if (status === 'ok') callback();
          return response;
        }),
      };
      const channel = { push: vi.fn(() => response) };
      reloaded.attach(channel as any);
      vi.advanceTimersByTime(ERROR_REPORT_LIMITS.lowPressureFlushIntervalMs);

      expect(channel.push).toHaveBeenCalledTimes(2);
      expect(channel.push.mock.calls[0][1].reports[0]).toMatchObject({
        report_id: sentId,
        count: 1,
      });
      expect(channel.push.mock.calls[1][1].reports[0]).toMatchObject({
        report_id: saved.reports[0].report_id,
        count: 1,
      });
      await reloaded.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves overflow occurrences added while a batch is in flight', async () => {
    vi.useFakeTimers();
    try {
      const storage = new TestStorage();
      const reporter = new DeviceErrorReporter(storage);
      await reporter.init('device-1');
      for (let index = 0; index <= ERROR_REPORT_LIMITS.reportBurst; index++) {
        reporter.report({ category: 'runtime', error: 'Overflow failure' });
      }
      const response = { receive: vi.fn(() => response) };
      const channel = { push: vi.fn(() => response) };
      reporter.attach(channel as any);
      const originalId = channel.push.mock.calls[0][1].dropped_report_id;

      reporter.report({ category: 'runtime', error: 'Overflow failure' });
      await reporter.close();
      const saved = JSON.parse(
        storage.getItem('castmill.device-error-buffer:device-1')!
      );
      expect(saved.inFlight.droppedReportId).toBe(originalId);
      expect(saved.droppedCount).toBe(1);
      expect(saved.droppedReportId).not.toBe(originalId);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the overflow ID stable across retries and reloads', async () => {
    vi.useFakeTimers();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const storage = new TestStorage();
      const reporter = new DeviceErrorReporter(storage);
      await reporter.init('device-1');
      for (
        let index = 0;
        index <= ERROR_REPORT_LIMITS.reportBurst;
        index += 1
      ) {
        reporter.report({ category: 'runtime', error: 'Overflow failure' });
      }

      let retry: (() => void) | undefined;
      const response = {
        receive: vi.fn((status: string, callback: () => void) => {
          if (status === 'error') {
            retry = callback;
          }
          return response;
        }),
      };
      const channel = { push: vi.fn(() => response) };
      reporter.attach(channel as any);
      retry?.();
      vi.advanceTimersByTime(ERROR_REPORT_LIMITS.retryBaseMs);

      const overflowId = channel.push.mock.calls[0][1].dropped_report_id;
      expect(overflowId).toEqual(expect.any(String));
      expect(channel.push.mock.calls[1][1].dropped_report_id).toBe(overflowId);
      await reporter.close();

      const reloadedReporter = new DeviceErrorReporter(storage);
      await reloadedReporter.init('device-1');
      const reloadedChannel = { push: vi.fn(() => response) };
      reloadedReporter.attach(reloadedChannel as any);

      expect(reloadedChannel.push.mock.calls[0][1].dropped_report_id).toBe(
        overflowId
      );
      await reloadedReporter.close();
    } finally {
      random.mockRestore();
      vi.useRealTimers();
    }
  });
});
