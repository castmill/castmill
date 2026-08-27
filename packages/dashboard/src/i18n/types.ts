/**
 * I18n types for type-safe translations
 */

import { Locale as DateFnsLocale } from 'date-fns';
import { enUS, es, sv, de, fr, zhCN, arSA, ko, ja } from 'date-fns/locale';

export type Locale =
  | 'en'
  | 'es'
  | 'sv'
  | 'de'
  | 'fr'
  | 'zh'
  | 'ar'
  | 'ko'
  | 'ja';

export interface LocaleInfo {
  code: Locale;
  name: string;
  nativeName: string;
  rtl?: boolean;
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'zh', name: 'Chinese (Mandarin)', nativeName: '中文' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_STORAGE_KEY = 'castmill_locale';

/**
 * Map our locale codes to date-fns locale objects
 */
export const LOCALE_DATE_FNS_MAP: Record<Locale, DateFnsLocale> = {
  en: enUS,
  es: es,
  sv: sv,
  de: de,
  fr: fr,
  zh: zhCN,
  ar: arSA,
  ko: ko,
  ja: ja,
};
