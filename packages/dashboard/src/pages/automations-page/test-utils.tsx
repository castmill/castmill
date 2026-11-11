import en from '../../i18n/locales/en.json';
import type { SummaryContext, TranslateFn } from './registry-types';

const lookup = (key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      en
    );

/** English translator backed by en.json, for unit tests. */
export const enT: TranslateFn = (key, params) => {
  const value = lookup(key);
  if (typeof value !== 'string') return key;
  return Object.entries(params ?? {}).reduce(
    (text, [name, param]) => text.replace(`{{${name}}}`, String(param)),
    value
  );
};

export const testSummaryContext = (
  names: Record<number, string> = {}
): SummaryContext => ({
  t: enT,
  locale: 'en-US',
  playlistName: (id) => names[id],
});
