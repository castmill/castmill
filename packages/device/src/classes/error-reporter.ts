import { Channel } from 'phoenix';

export const ERROR_REPORT_LIMITS = {
  maxReports: 50,
  maxBytes: 64 * 1024,
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  maxMessageLength: 1024,
  maxStackLength: 4096,
  maxBatchReports: 20,
  maxBatchBytes: 32 * 1024,
  lowPressureFlushIntervalMs: 1000,
  mediumPressureFlushIntervalMs: 5000,
  highPressureFlushIntervalMs: 15 * 1000,
  maxFlushIntervalMs: 60 * 1000,
  flushPressureWindowMs: 60 * 1000,
  maxReportsPerMinute: 120,
  reportBurst: 20,
  retryBaseMs: 1000,
  retryMaxMs: 60 * 1000,
  persistDebounceMs: 5000,
} as const;

const BUFFER_VERSION = 1;
const MAX_OCCURRENCE_COUNT = 2_147_483_647;
const STORAGE_KEY_PREFIX = 'castmill.device-error-buffer:';
const SENSITIVE_KEY =
  /(authorization|token|password|secret|credential|cookie)/i;
const URL_SUFFIX = /([?#]).*$/;

export type DeviceErrorCategory =
  | 'playback'
  | 'media-load'
  | 'cache'
  | 'schedule'
  | 'network-sync'
  | 'runtime'
  | 'device';

export interface DeviceErrorContext {
  playlistId?: string | number;
  layerId?: string | number;
  layerName?: string;
  widgetId?: string | number;
  mediaId?: string | number;
  appVersion?: string;
}

export interface DeviceErrorInput {
  category: DeviceErrorCategory;
  error: unknown;
  code?: string;
  context?: DeviceErrorContext;
}

export interface DeviceErrorReport {
  report_id: string;
  fingerprint: string;
  category: DeviceErrorCategory;
  code?: string;
  message: string;
  stack?: string;
  context?: DeviceErrorContext;
  count: number;
  first_occurred_at: string;
  last_occurred_at: string;
}

interface PendingReport extends DeviceErrorReport {
  firstOccurredAtMs: number;
  lastOccurredAtMs: number;
}

interface PersistedBuffer {
  version: number;
  reports: PendingReport[];
  droppedCount: number;
}

interface InFlightBatch {
  reports: DeviceErrorReport[];
  droppedCount: number;
}

type ErrorReportStorage = Pick<Storage, 'getItem' | 'setItem'>;

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength && stringByteLength(value) <= maxLength) {
    return value;
  }

  const suffix = '…';
  let end = Math.min(value.length, maxLength - suffix.length);

  while (
    end > 0 &&
    stringByteLength(`${value.slice(0, end)}${suffix}`) > maxLength
  ) {
    end -= 1;
  }

  return `${value.slice(0, end)}${suffix}`;
}

function stringByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }

  return unescape(encodeURIComponent(value)).length;
}

function sanitizeText(value: string, maxLength: number): string {
  return truncate(
    value.replace(URL_SUFFIX, '$1[redacted]').replace(/\s+/g, ' ').trim(),
    maxLength
  );
}

function errorDetails(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: sanitizeText(
        error.message || error.name,
        ERROR_REPORT_LIMITS.maxMessageLength
      ),
      stack: error.stack ? sanitizeStack(error.stack) : undefined,
    };
  }

  if (typeof error === 'string') {
    return {
      message: sanitizeText(error, ERROR_REPORT_LIMITS.maxMessageLength),
    };
  }

  return {
    message: sanitizeText(
      String(error || 'Unknown error'),
      ERROR_REPORT_LIMITS.maxMessageLength
    ),
  };
}

function sanitizeStack(value: string): string {
  return truncate(
    value.replace(URL_SUFFIX, '$1[redacted]'),
    ERROR_REPORT_LIMITS.maxStackLength
  );
}

function sanitizeContext(
  context?: DeviceErrorContext
): DeviceErrorContext | undefined {
  if (!context) {
    return undefined;
  }

  const result: DeviceErrorContext = {};
  Object.keys(context).forEach((key) => {
    if (SENSITIVE_KEY.test(key)) {
      return;
    }

    const value = context[key as keyof DeviceErrorContext];
    if (typeof value === 'string' || typeof value === 'number') {
      result[key as keyof DeviceErrorContext] =
        typeof value === 'string' ? sanitizeText(value, 256) : String(value);
    }
  });

  return Object.keys(result).length > 0 ? result : undefined;
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function reportId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function byteLength(value: unknown): number {
  const string = JSON.stringify(value);
  return stringByteLength(string);
}

function isValidReport(report: unknown): report is PendingReport {
  if (!report || typeof report !== 'object') {
    return false;
  }

  const candidate = report as PendingReport;
  return (
    typeof candidate.fingerprint === 'string' &&
    typeof candidate.category === 'string' &&
    typeof candidate.message === 'string' &&
    Number.isInteger(candidate.count) &&
    candidate.count > 0 &&
    candidate.count <= MAX_OCCURRENCE_COUNT &&
    Number.isFinite(candidate.firstOccurredAtMs) &&
    Number.isFinite(candidate.lastOccurredAtMs)
  );
}

function normalizeStoredReport(report: PendingReport): PendingReport {
  return {
    ...report,
    report_id: truncate(report.report_id, 64),
    fingerprint: truncate(report.fingerprint, 128),
    message: sanitizeText(report.message, ERROR_REPORT_LIMITS.maxMessageLength),
    stack: report.stack ? sanitizeStack(report.stack) : undefined,
    context: sanitizeContext(report.context),
  };
}

export class DeviceErrorReporter {
  private reports = new Map<string, PendingReport>();
  private droppedCount = 0;
  private channel?: Channel;
  private inFlight?: InFlightBatch;
  private persistTimer?: ReturnType<typeof setTimeout>;
  private flushTimer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private retryAttempt = 0;
  private lastFlushAt?: number;
  private nextFlushAt = 0;
  private scheduledFlushAt = 0;
  private recentReportTimes: number[] = [];
  private rateTokens: number = ERROR_REPORT_LIMITS.reportBurst;
  private lastRateRefillAt = Date.now();
  private previousWindowOnError: OnErrorEventHandler | null = null;
  private lastGlobalError?: { error: unknown; reportedAt: number };
  private reporting = false;
  private runtimeCaptureEnabled = false;
  private initialized = false;
  private storageKey?: string;
  private readonly onWindowError = (event: ErrorEvent) => {
    this.reportGlobalError(
      event.error || event.message || 'Uncaught runtime error'
    );
  };
  private readonly onWindowErrorFallback: OnErrorEventHandlerNonNull = (
    message,
    _source,
    _line,
    _column,
    error
  ) => {
    this.reportGlobalError(
      error ||
        (typeof message === 'string' ? message : 'Uncaught runtime error')
    );

    return (
      this.previousWindowOnError?.call(
        window,
        message,
        _source,
        _line,
        _column,
        error
      ) || false
    );
  };
  private readonly onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason || 'Unhandled promise rejection';
    this.report({
      category: 'runtime',
      error,
    });
  };
  private readonly onPageHide = () => {
    void this.persist();
  };

  constructor(private storage?: ErrorReportStorage) {}

  enableRuntimeCapture(): void {
    if (this.runtimeCaptureEnabled || typeof window === 'undefined') {
      return;
    }
    this.runtimeCaptureEnabled = true;
    this.previousWindowOnError = window.onerror;
    window.onerror = this.onWindowErrorFallback;
    window.addEventListener('error', this.onWindowError);
    window.addEventListener('unhandledrejection', this.onUnhandledRejection);
    window.addEventListener('pagehide', this.onPageHide);
  }

  async init(deviceId: string): Promise<void> {
    const storageKey = `${STORAGE_KEY_PREFIX}${deviceId}`;
    if (this.initialized && this.storageKey === storageKey) {
      return;
    }

    if (this.storageKey && this.storageKey !== storageKey) {
      this.reports.clear();
      this.droppedCount = 0;
    }

    this.initialized = true;
    this.storageKey = storageKey;
    this.enableRuntimeCapture();

    try {
      const stored = this.getStorage()?.getItem(storageKey);
      if (stored) {
        const buffer = JSON.parse(stored) as PersistedBuffer;
        if (
          buffer.version === BUFFER_VERSION &&
          Array.isArray(buffer.reports)
        ) {
          buffer.reports
            .filter(isValidReport)
            .map(normalizeStoredReport)
            .forEach((report) => this.reports.set(report.fingerprint, report));
          this.droppedCount =
            typeof buffer.droppedCount === 'number' && buffer.droppedCount > 0
              ? Math.min(MAX_OCCURRENCE_COUNT, Math.floor(buffer.droppedCount))
              : 0;
          this.enforceLimits();
        }
      }
    } catch (error) {
      console.warn(
        '[DeviceErrorReporter] Discarding invalid persisted error buffer',
        error
      );
      this.reports.clear();
      this.droppedCount = 0;
    }
  }

  attach(channel: Channel): void {
    this.channel = channel;
    this.retryAttempt = 0;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }

    if (this.inFlight) {
      this.sendBatch(this.inFlight, true);
      return;
    }

    this.flushNow(true);
  }

  detach(): void {
    this.channel = undefined;
  }

  report(input: DeviceErrorInput): void {
    if (this.reporting) {
      return;
    }

    if (!this.consumeRateToken()) {
      this.recordDroppedError();
      return;
    }

    this.reporting = true;
    try {
      const details = errorDetails(input.error);
      const context = sanitizeContext(input.context);
      const fingerprint = hash(
        [
          input.category,
          input.code || '',
          details.message,
          details.stack ? details.stack.split('\n')[1] || '' : '',
          context?.playlistId || '',
          context?.layerId || '',
          context?.widgetId || '',
          context?.mediaId || '',
        ].join('|')
      );
      const now = Date.now();
      this.recordRecentReport(now);
      const existing = this.reports.get(fingerprint);

      if (existing) {
        if (existing.count < MAX_OCCURRENCE_COUNT) {
          existing.count += 1;
        } else {
          this.droppedCount = Math.min(
            MAX_OCCURRENCE_COUNT,
            this.droppedCount + 1
          );
        }
        existing.lastOccurredAtMs = now;
        existing.last_occurred_at = new Date(now).toISOString();
        existing.message = details.message;
        existing.stack = details.stack;
        existing.context = context;
      } else {
        this.reports.set(fingerprint, {
          report_id: reportId(),
          fingerprint,
          category: input.category,
          code: input.code,
          message: details.message,
          stack: details.stack,
          context,
          count: 1,
          firstOccurredAtMs: now,
          lastOccurredAtMs: now,
          first_occurred_at: new Date(now).toISOString(),
          last_occurred_at: new Date(now).toISOString(),
        });
      }

      this.enforceLimits(!existing);
      this.schedulePersist();
      this.flushNow();
      this.scheduleAdaptiveFlush();
    } catch (error) {
      console.warn(
        '[DeviceErrorReporter] Failed to record device error',
        error
      );
    } finally {
      this.reporting = false;
    }
  }

  async close(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = undefined;
    }
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.scheduledFlushAt = 0;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
    await this.persist();
    this.detach();
    this.initialized = false;
    this.disableRuntimeCapture();
  }

  private enforceLimits(checkSerializedSize = true): void {
    const cutoff = Date.now() - ERROR_REPORT_LIMITS.maxAgeMs;
    this.reports.forEach((report, fingerprint) => {
      if (report.lastOccurredAtMs < cutoff) {
        this.reports.delete(fingerprint);
        this.droppedCount = Math.min(
          MAX_OCCURRENCE_COUNT,
          this.droppedCount + report.count
        );
      }
    });

    while (
      this.reports.size > ERROR_REPORT_LIMITS.maxReports ||
      (checkSerializedSize &&
        byteLength(this.toPersistedBuffer()) > ERROR_REPORT_LIMITS.maxBytes)
    ) {
      let oldest: PendingReport | undefined;
      this.reports.forEach((report) => {
        if (!oldest || report.lastOccurredAtMs < oldest.lastOccurredAtMs) {
          oldest = report;
        }
      });
      if (!oldest) {
        return;
      }
      this.reports.delete(oldest.fingerprint);
      this.droppedCount = Math.min(
        MAX_OCCURRENCE_COUNT,
        this.droppedCount + oldest.count
      );
    }
  }

  private disableRuntimeCapture(): void {
    if (!this.runtimeCaptureEnabled || typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('error', this.onWindowError);
    window.removeEventListener('unhandledrejection', this.onUnhandledRejection);
    window.removeEventListener('pagehide', this.onPageHide);
    if (window.onerror === this.onWindowErrorFallback) {
      window.onerror = this.previousWindowOnError;
    }
    this.previousWindowOnError = null;
    this.runtimeCaptureEnabled = false;
  }

  private consumeRateToken(): boolean {
    const now = Date.now();
    const elapsed = Math.max(0, now - this.lastRateRefillAt);
    this.lastRateRefillAt = now;
    this.rateTokens = Math.min(
      ERROR_REPORT_LIMITS.reportBurst,
      this.rateTokens +
        (elapsed * ERROR_REPORT_LIMITS.maxReportsPerMinute) / 60_000
    );

    if (this.rateTokens < 1) {
      return false;
    }

    this.rateTokens -= 1;
    return true;
  }

  private recordDroppedError(): void {
    this.droppedCount = Math.min(MAX_OCCURRENCE_COUNT, this.droppedCount + 1);
    this.schedulePersist();
    this.scheduleAdaptiveFlush();
  }

  private reportGlobalError(error: unknown): void {
    const now = Date.now();
    const lastGlobalError = this.lastGlobalError;
    if (
      lastGlobalError &&
      lastGlobalError.error === error &&
      now - lastGlobalError.reportedAt < 100
    ) {
      return;
    }

    this.lastGlobalError = { error, reportedAt: now };
    this.report({
      category: 'runtime',
      error,
    });
  }

  private recordRecentReport(now: number): void {
    this.recentReportTimes.push(now);
    this.pruneRecentReports(now);

    if (this.lastFlushAt !== undefined) {
      this.nextFlushAt = this.lastFlushAt + this.flushInterval(now);
    }
  }

  private pruneRecentReports(now: number): void {
    const cutoff = now - ERROR_REPORT_LIMITS.flushPressureWindowMs;
    this.recentReportTimes = this.recentReportTimes.filter(
      (reportTime) => reportTime >= cutoff
    );
  }

  private flushInterval(now = Date.now()): number {
    this.pruneRecentReports(now);
    const count = this.recentReportTimes.length;

    if (count <= 5) {
      return ERROR_REPORT_LIMITS.lowPressureFlushIntervalMs;
    }

    if (count <= 20) {
      return ERROR_REPORT_LIMITS.mediumPressureFlushIntervalMs;
    }

    if (count <= 60) {
      return ERROR_REPORT_LIMITS.highPressureFlushIntervalMs;
    }

    return ERROR_REPORT_LIMITS.maxFlushIntervalMs;
  }

  private toPersistedBuffer(): PersistedBuffer {
    return {
      version: BUFFER_VERSION,
      reports: Array.from(this.reports.values()),
      droppedCount: this.droppedCount,
    };
  }

  private schedulePersist(): void {
    if (this.persistTimer) {
      return;
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = undefined;
      void this.persist();
    }, ERROR_REPORT_LIMITS.persistDebounceMs);
  }

  private async persist(): Promise<void> {
    const storage = this.getStorage();
    if (!storage || !this.storageKey) {
      return;
    }

    try {
      this.enforceLimits();
      storage.setItem(
        this.storageKey,
        JSON.stringify(this.toPersistedBuffer())
      );
    } catch (error) {
      console.warn(
        '[DeviceErrorReporter] Failed to persist error buffer',
        error
      );
    }
  }

  private getStorage(): ErrorReportStorage | undefined {
    if (this.storage) {
      return this.storage;
    }

    try {
      return typeof window === 'undefined' ? undefined : window.localStorage;
    } catch {
      return undefined;
    }
  }

  private scheduleAdaptiveFlush(): void {
    if (
      !this.channel ||
      this.inFlight ||
      (this.reports.size === 0 && this.droppedCount === 0)
    ) {
      return;
    }

    const now = Date.now();
    const scheduledAt = Math.max(this.nextFlushAt, now);

    if (this.flushTimer && this.scheduledFlushAt === scheduledAt) {
      return;
    }

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.scheduledFlushAt = scheduledAt;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.scheduledFlushAt = 0;
      this.flushNow();
      this.scheduleAdaptiveFlush();
    }, scheduledAt - now);
  }

  private flushNow(force = false): void {
    if (!this.channel) {
      return;
    }

    if (this.inFlight) {
      return;
    }

    if (this.reports.size === 0 && this.droppedCount === 0) {
      return;
    }

    if (!force && Date.now() < this.nextFlushAt) {
      return;
    }

    const reports: DeviceErrorReport[] = [];
    const orderedReports = Array.from(this.reports.values()).sort(
      (left, right) => left.lastOccurredAtMs - right.lastOccurredAtMs
    );

    for (const aggregate of orderedReports) {
      if (reports.length >= ERROR_REPORT_LIMITS.maxBatchReports) {
        break;
      }

      const snapshot: DeviceErrorReport = {
        report_id: reportId(),
        fingerprint: aggregate.fingerprint,
        category: aggregate.category,
        code: aggregate.code,
        message: aggregate.message,
        stack: aggregate.stack,
        context: aggregate.context,
        count: aggregate.count,
        first_occurred_at: aggregate.first_occurred_at,
        last_occurred_at: aggregate.last_occurred_at,
      };
      if (
        reports.length > 0 &&
        byteLength({
          reports: [...reports, snapshot],
          dropped_count: this.droppedCount,
        }) > ERROR_REPORT_LIMITS.maxBatchBytes
      ) {
        break;
      }
      reports.push(snapshot);
    }

    if (reports.length === 0 && this.droppedCount === 0) {
      return;
    }

    const batch = { reports, droppedCount: this.droppedCount };
    this.lastFlushAt = Date.now();
    this.nextFlushAt = this.lastFlushAt + this.flushInterval(this.lastFlushAt);
    this.sendBatch(batch);
  }

  private sendBatch(batch: InFlightBatch, isRetry = false): void {
    if (
      !this.channel ||
      (this.inFlight && (!isRetry || this.inFlight !== batch))
    ) {
      return;
    }

    this.inFlight = batch;
    this.channel
      .push('errors:report', {
        reports: batch.reports,
        dropped_count: batch.droppedCount,
      })
      .receive('ok', () => {
        if (this.inFlight !== batch) {
          return;
        }
        batch.reports.forEach((sent) => {
          const current = this.reports.get(sent.fingerprint);
          if (!current) {
            return;
          }
          current.count -= sent.count;
          if (current.count <= 0) {
            this.reports.delete(sent.fingerprint);
          }
        });
        this.droppedCount = Math.max(0, this.droppedCount - batch.droppedCount);
        this.inFlight = undefined;
        if (this.retryTimer) {
          clearTimeout(this.retryTimer);
          this.retryTimer = undefined;
        }
        this.retryAttempt = 0;
        this.schedulePersist();
        this.scheduleAdaptiveFlush();
      })
      .receive('error', () => this.retry(batch))
      .receive('timeout', () => this.retry(batch));
  }

  private retry(batch: InFlightBatch): void {
    if (this.inFlight !== batch) {
      return;
    }
    const delay = Math.min(
      ERROR_REPORT_LIMITS.retryBaseMs * Math.pow(2, this.retryAttempt),
      ERROR_REPORT_LIMITS.retryMaxMs
    );
    this.retryAttempt += 1;
    this.retryTimer = setTimeout(
      () => {
        this.retryTimer = undefined;
        this.sendBatch(batch, true);
      },
      delay + Math.floor(Math.random() * 250)
    );
  }
}
