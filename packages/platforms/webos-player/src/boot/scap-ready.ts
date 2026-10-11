declare global {
  interface Window {
    castmillScapReady?: Promise<void>;
  }
}

export const SCAP_READY_TIMEOUT_MS = 30_000;

/**
 * Resolves once public/lib/scap-loader.js has loaded every SCAP library.
 * Native modules construct SCAP objects at import time, so they must only be
 * imported after this resolves.
 */
export function waitForScap(
  timeoutMs: number = SCAP_READY_TIMEOUT_MS
): Promise<void> {
  const ready = window.castmillScapReady;
  if (!ready) {
    return Promise.reject(new Error('SCAP loader is not available'));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timed out loading the SCAP libraries')),
      timeoutMs
    );
    ready.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}
