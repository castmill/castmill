/** How often the main-thread watchdog checks in. */
export const STALL_CHECK_INTERVAL_MS = 5_000;
/** A gap this long between check-ins means the page was blocked or broken. */
export const MAIN_THREAD_STALL_MS = 60_000;
/** Maximum time from app start until the player is mounted. */
export const STARTUP_TIMEOUT_MS = 3 * 60_000;

export interface StallWatchdogOptions {
  /** Called once with the measured gap; the watchdog stops itself first. */
  onStall(stalledMs: number): void;
  now?: () => number;
}

const monotonicNow = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/**
 * Replaces the old WebOS wrapper's iframe heartbeat check: the app is no
 * longer hosted in a frame, so it watches its own event loop instead. Uses a
 * monotonic clock so NTP corrections after boot are not mistaken for stalls,
 * and ignores time spent hidden (e.g. while the display is in standby).
 */
export function startStallWatchdog({
  onStall,
  now = monotonicNow,
}: StallWatchdogOptions): () => void {
  let lastTick = now();
  let stopped = false;

  const isHidden = () =>
    typeof document !== 'undefined' && document.visibilityState === 'hidden';

  const onVisibilityChange = () => {
    lastTick = now();
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };

  const timer = setInterval(() => {
    const current = now();
    const gap = current - lastTick;
    lastTick = current;
    if (isHidden() || gap < MAIN_THREAD_STALL_MS) return;
    stop();
    onStall(gap);
  }, STALL_CHECK_INTERVAL_MS);

  document.addEventListener('visibilitychange', onVisibilityChange);
  return stop;
}
