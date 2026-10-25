import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAIN_THREAD_STALL_MS,
  STALL_CHECK_INTERVAL_MS,
  startStallWatchdog,
} from './runtime-watchdog';

describe('startStallWatchdog', () => {
  let clock = 0;
  const now = () => clock;
  const tick = (gap: number) => {
    clock += gap;
    vi.advanceTimersByTime(STALL_CHECK_INTERVAL_MS);
  };
  let visibility: DocumentVisibilityState = 'visible';

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
      () => visibility
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('stays quiet while the event loop keeps ticking', () => {
    const onStall = vi.fn();
    const stop = startStallWatchdog({ onStall, now });
    for (let i = 0; i < 100; i++) tick(STALL_CHECK_INTERVAL_MS);
    expect(onStall).not.toHaveBeenCalled();
    stop();
  });

  it('reports a long gap between check-ins once', () => {
    const onStall = vi.fn();
    startStallWatchdog({ onStall, now });
    tick(MAIN_THREAD_STALL_MS + 1);
    tick(MAIN_THREAD_STALL_MS + 1);
    expect(onStall).toHaveBeenCalledOnce();
    expect(onStall).toHaveBeenCalledWith(MAIN_THREAD_STALL_MS + 1);
  });

  it('ignores time spent hidden', () => {
    const onStall = vi.fn();
    startStallWatchdog({ onStall, now });
    visibility = 'hidden';
    tick(MAIN_THREAD_STALL_MS * 3);
    clock += MAIN_THREAD_STALL_MS * 3;
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    tick(STALL_CHECK_INTERVAL_MS);
    expect(onStall).not.toHaveBeenCalled();
  });

  it('stops checking after cleanup', () => {
    const onStall = vi.fn();
    const remove = vi.spyOn(document, 'removeEventListener');
    const stop = startStallWatchdog({ onStall, now });
    stop();
    stop();
    tick(MAIN_THREAD_STALL_MS * 2);
    expect(onStall).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledOnce();
  });

  it('uses a monotonic clock by default', () => {
    const performanceNow = vi.spyOn(performance, 'now');
    const stop = startStallWatchdog({ onStall: vi.fn() });
    expect(performanceNow).toHaveBeenCalled();
    stop();
  });
});
