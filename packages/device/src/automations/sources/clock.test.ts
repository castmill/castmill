import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOCK_LATE_TOLERANCE_MS, ClockSource } from './clock';
import { defaultScheduler } from '../types';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

describe('ClockSource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const start = (
    occurrences: unknown[],
    validUntil = 14 * DAY,
    source = new ClockSource()
  ) => {
    const emit = vi.fn();
    source.start({ occurrences }, emit, {
      scheduler: defaultScheduler,
      validUntil,
      condition: 'at',
    });
    return { source, emit };
  };

  it('fires at each occurrence with a fake clock', () => {
    const { emit, source } = start([10 * MINUTE, 70 * MINUTE]);
    expect(source.next()).toBe(10 * MINUTE);

    vi.advanceTimersByTime(10 * MINUTE - 1);
    expect(emit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({ type: 'fire' });
    expect(source.next()).toBe(70 * MINUTE);

    vi.advanceTimersByTime(60 * MINUTE);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(source.next()).toBeUndefined();
  });

  it('sorts occurrences and ignores invalid entries', () => {
    const { emit } = start([20 * MINUTE, 'x', null, 5 * MINUTE]);
    vi.advanceTimersByTime(5 * MINUTE);
    expect(emit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(15 * MINUTE);
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('accepts a payload without occurrences', () => {
    const source = new ClockSource();
    const emit = vi.fn();
    source.start({}, emit, {
      scheduler: defaultScheduler,
      validUntil: DAY,
      condition: 'at',
    });
    expect(source.next()).toBeUndefined();
    vi.advanceTimersByTime(DAY);
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not catch up occurrences missed while the device was off', () => {
    vi.setSystemTime(3 * 60 * MINUTE);
    const { emit, source } = start([MINUTE, 2 * MINUTE, 4 * 60 * MINUTE]);
    expect(emit).not.toHaveBeenCalled();
    expect(source.next()).toBe(4 * 60 * MINUTE);
  });

  it('fires an occurrence that is only slightly late, once', () => {
    vi.setSystemTime(10 * MINUTE + 30 * 1000);
    const { emit } = start([10 * MINUTE, 10 * MINUTE + 10 * 1000]);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('drops occurrences when timers were paused beyond the tolerance', () => {
    const { emit } = start([10 * MINUTE]);
    // Simulate the display sleeping: the wall clock jumps, timers did not run.
    vi.setSystemTime(10 * MINUTE + CLOCK_LATE_TOLERANCE_MS + 1);
    vi.advanceTimersByTime(MINUTE);
    expect(emit).not.toHaveBeenCalled();
  });

  it('re-checks the wall clock at least every minute', () => {
    const { emit } = start([3 * 60 * MINUTE]);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(MINUTE);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(3 * 60 * MINUTE);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('stops firing after the payload expires (14 days offline)', () => {
    const { emit, source } = start([DAY, 15 * DAY], 14 * DAY);
    vi.advanceTimersByTime(DAY);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(source.next()).toBeUndefined();
    vi.advanceTimersByTime(15 * DAY);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not emit a due occurrence after the payload has expired', () => {
    const validUntil = 2 * MINUTE;
    const { emit } = start([MINUTE], validUntil);

    vi.setSystemTime(validUntil + 30 * 1000);
    vi.advanceTimersByTime(MINUTE);

    expect(emit).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not fire once stopped, also when stopped by its own emission', () => {
    const source = new ClockSource();
    const emit = vi.fn(() => source.stop());
    source.start({ occurrences: [MINUTE, 2 * MINUTE] }, emit, {
      scheduler: defaultScheduler,
      validUntil: DAY,
      condition: 'at',
    });
    vi.advanceTimersByTime(5 * MINUTE);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restarts with a new payload', () => {
    const { source, emit } = start([MINUTE]);
    const { emit: second } = start([2 * MINUTE], DAY, source);
    vi.advanceTimersByTime(5 * MINUTE);
    expect(emit).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('reports no next firing before it is started', () => {
    expect(new ClockSource().next()).toBeUndefined();
  });
});
