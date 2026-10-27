import type { NativePortraitApi } from '../shared/orientation';
import { scapRequest } from './request';

const request = <T>(invoke: Parameters<typeof scapRequest<T>>[1]) =>
  scapRequest<T>('native orientation', invoke);

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
