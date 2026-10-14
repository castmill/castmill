import { scapRequest } from './request';

let cachedVersion: Promise<string | undefined> | undefined;

/**
 * Returns the webOS Signage version (e.g. "4.1.0") via LG's custom.js, or
 * undefined when the firmware does not expose it. Successful lookups are
 * cached for the app lifetime.
 */
export function getWebosVersion(): Promise<string | undefined> {
  if (cachedVersion) return cachedVersion;
  if (typeof Custom === 'undefined') return Promise.resolve(undefined);
  const signage = new Custom().Signage;
  const get = signage?.getwebOSVersion;
  if (!get) return Promise.resolve(undefined);
  const lookup = scapRequest<{ webOSVersion?: unknown }>(
    'version',
    (resolve, reject) => get.call(signage, resolve, reject)
  ).then(({ webOSVersion }) =>
    typeof webOSVersion === 'string' && webOSVersion ? webOSVersion : undefined
  );
  cachedVersion = lookup;
  lookup.then(
    (version) => {
      if (!version) cachedVersion = undefined;
    },
    () => {
      cachedVersion = undefined;
    }
  );
  return lookup;
}

export function resetWebosVersionCache(): void {
  cachedVersion = undefined;
}
