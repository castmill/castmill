import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import sv from './locales/sv.json';
import zh from './locales/zh.json';

type LegacyTranslations = typeof en;
type LegacyLocale =
  | 'ar'
  | 'de'
  | 'en'
  | 'es'
  | 'fr'
  | 'ja'
  | 'ko'
  | 'sv'
  | 'zh';

const DEFAULT_LOCALE: LegacyLocale = 'en';
const RTL_LOCALES = new Set<LegacyLocale>(['ar']);

const translations: Record<LegacyLocale, LegacyTranslations> = {
  ar,
  de,
  en,
  es,
  fr,
  ja,
  ko,
  sv,
  zh,
};

const getLegacyLocale = (
  language = globalThis.navigator?.language
): LegacyLocale => {
  const locale = language?.toLowerCase().split('-')[0] as
    | LegacyLocale
    | undefined;
  return locale && locale in translations ? locale : DEFAULT_LOCALE;
};

const getTranslationValue = (
  messages: Record<string, unknown>,
  key: string
): string | undefined =>
  key.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    return (value as Record<string, unknown>)[part];
  }, messages) as string | undefined;

export const useLegacyI18n = () => {
  const locale = getLegacyLocale();

  return {
    isRtl: RTL_LOCALES.has(locale),
    locale,
    t: (key: string) =>
      getTranslationValue(
        translations[locale] as Record<string, unknown>,
        key
      ) ??
      getTranslationValue(
        translations[DEFAULT_LOCALE] as Record<string, unknown>,
        key
      ) ??
      key,
  };
};
