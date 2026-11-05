const RETRY_COUNT_KEY = 'castmill-webos-startup-retries';
export const STARTUP_RETRY_STEP_MS = 60_000;
export const MAX_STARTUP_RETRY_DELAY_MS = 9 * 60_000;

function readAttempts(): number {
  try {
    const value = Number(sessionStorage.getItem(RETRY_COUNT_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * Reloads the app after a startup failure, backing off by one minute per
 * consecutive failure up to nine minutes, as the old WebOS wrapper did.
 * Returns the scheduled delay in milliseconds.
 */
export function scheduleStartupRetry(
  reload: () => void = () => window.location.reload()
): number {
  const attempts = readAttempts() + 1;
  try {
    sessionStorage.setItem(RETRY_COUNT_KEY, String(attempts));
  } catch {
    // Without sessionStorage the retry still happens with the minimum delay.
  }
  const delay = Math.min(
    MAX_STARTUP_RETRY_DELAY_MS,
    attempts * STARTUP_RETRY_STEP_MS
  );
  setTimeout(reload, delay);
  return delay;
}

export function resetStartupRetry(): void {
  try {
    sessionStorage.removeItem(RETRY_COUNT_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}
