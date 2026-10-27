export const SCAP_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Wraps a callback-style SCAP call in a promise that rejects when SCAP throws,
 * fails, or never calls back. Some firmware silently drops unsupported calls.
 */
export function scapRequest<T>(
  name: string,
  invoke: (
    resolve: (value: T) => void,
    reject: (error: unknown) => void
  ) => void,
  timeoutMs = SCAP_REQUEST_TIMEOUT_MS
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`WebOS ${name} request timed out`)),
      timeoutMs
    );
    try {
      invoke(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}
