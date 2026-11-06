import type { Emission, EventSource, Scheduler, SourceContext } from '../types';

/** Occurrences more than this late (e.g. after a sleep) are not fired. */
export const CLOCK_LATE_TOLERANCE_MS = 60 * 1000;

/**
 * Re-check interval. Timers on old players drift and pause while the display
 * sleeps, so long waits are split and the wall clock is checked again.
 */
export const CLOCK_MAX_TIMER_MS = 60 * 1000;

/**
 * The clock source fires at occurrences expanded by the server (UTC epoch
 * milliseconds for the next 14 days), so the device needs no time zone
 * database. Missed occurrences are not caught up, and nothing fires after the
 * payload's `valid_until`.
 */
export class ClockSource implements EventSource {
  private occurrences: number[] = [];
  private cursor = 0;
  private handle: unknown;
  private scheduler?: Scheduler;
  private validUntil = 0;
  private emit?: (emission: Emission) => void;

  start(
    config: Record<string, unknown>,
    emit: (emission: Emission) => void,
    context: SourceContext
  ): void {
    this.stop();
    const raw = Array.isArray(config.occurrences) ? config.occurrences : [];
    this.occurrences = raw
      .filter((value): value is number => typeof value === 'number')
      .sort((a, b) => a - b);
    this.cursor = 0;
    this.scheduler = context.scheduler;
    this.validUntil = context.validUntil;
    this.emit = emit;
    this.check();
  }

  stop(): void {
    if (this.scheduler && this.handle !== undefined) {
      this.scheduler.clearTimeout(this.handle);
    }
    this.handle = undefined;
    this.emit = undefined;
  }

  next(): number | undefined {
    const now = this.scheduler ? this.scheduler.now() : Date.now();
    for (let i = this.cursor; i < this.occurrences.length; i++) {
      const at = this.occurrences[i];
      if (at > this.validUntil) return undefined;
      if (at + CLOCK_LATE_TOLERANCE_MS >= now) return at;
    }
    return undefined;
  }

  private check = () => {
    this.handle = undefined;
    const scheduler = this.scheduler;
    const emit = this.emit;
    if (!scheduler || !emit) return;

    const now = scheduler.now();
    let due = false;
    while (this.cursor < this.occurrences.length) {
      const at = this.occurrences[this.cursor];
      if (at > now) break;
      this.cursor++;
      // Several occurrences may be due after a pause; fire at most once.
      if (now - at <= CLOCK_LATE_TOLERANCE_MS && at <= this.validUntil) {
        due = true;
      }
    }

    if (due) emit({ type: 'fire' });
    if (this.emit !== emit) return; // stopped by the emission

    const next = this.occurrences[this.cursor];
    if (next === undefined || next > this.validUntil) return;
    const delay = Math.max(0, Math.min(next - now, CLOCK_MAX_TIMER_MS));
    this.handle = scheduler.setTimeout(this.check, delay);
  };
}
