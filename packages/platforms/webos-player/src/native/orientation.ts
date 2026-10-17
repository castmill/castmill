import type { NativePortraitApi } from '../shared/orientation';

const NATIVE_ORIENTATION_TIMEOUT_MS = 10_000;

function request<T>(
  invoke: (
    resolve: (value: T) => void,
    reject: (error: unknown) => void
  ) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('WebOS native orientation request timed out')),
      NATIVE_ORIENTATION_TIMEOUT_MS
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

export function getNativePortraitApi(): NativePortraitApi | undefined {
  if (typeof Custom === 'undefined') return;
  const configuration = new Custom().Configuration;
  const get = configuration?.getNativePortraitMode;
  const set = configuration?.setNativePortraitMode;
  if (!get || !set) return;
  return {
    getNativePortraitMode: () =>
      request((resolve, reject) => get.call(configuration, resolve, reject)),
    setNativePortraitMode: (options) =>
      request<void>((resolve, reject) =>
        set.call(configuration, () => resolve(), reject, options)
      ),
  };
}
