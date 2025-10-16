/**
 * I18n Context and Provider for the Dashboard
 *
 * Provides translation functions and locale management throughout the app.
 * Includes support for:
 * - Text translation with parameter interpolation
 * - Pluralization
 * - Date/time formatting
 * - Number formatting
 * - Currency formatting
 */

import {
  createContext,
  useContext,
  createSignal,
  createEffect,
  JSX,
  Accessor,
} from 'solid-js';
import {
  Locale,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  LOCALE_DATE_FNS_MAP,
} from './types';
import { format as formatDate, parseISO } from 'date-fns';

// Import all translation files
import en from './locales/en.json';

// Translation type based on English translations
export type Translations = typeof en;

// Translation key paths (for type-safety)
export type TranslationKey = string;

// Plural forms
export type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

interface I18nContextValue {
  locale: Accessor<Locale>;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  tp: (
    key: TranslationKey,
    count: number,
    params?: Record<string, string | number>
  ) => string;
  formatDate: (date: Date | string, formatStr?: string) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (
    value: number,
    currency?: string,
    options?: Intl.NumberFormatOptions
  ) => string;
  translations: Accessor<Translations>;
}

const I18nContext = createContext<I18nContextValue>();

/**
 * Load translations for a given locale
 */
async function loadTranslations(locale: Locale): Promise<Translations> {
  try {
    // Dynamic import based on locale
    const translations = await import(`./locales/${locale}.json`);
    return translations.default || translations;
  } catch (error) {
    console.warn(
      `Failed to load translations for locale: ${locale}, falling back to English`
    );
    return en;
  }
}

/**
 * Get the initial locale from localStorage or browser settings
 */
function getInitialLocale(): Locale {
  // Check localStorage first
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) {
    return stored as Locale;
  }

  // Try to detect from browser
  if (typeof navigator !== 'undefined') {
    const preferredLanguages =
      (navigator.languages && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language]) ?? [];

    const browserLang = preferredLanguages
      .map((lang) =>
        typeof lang === 'string' ? lang.split('-')[0] : undefined
      )
      .find((lang): lang is string => Boolean(lang));

    if (browserLang && SUPPORTED_LOCALES.some((l) => l.code === browserLang)) {
      return browserLang as Locale;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Get a nested value from an object using a dot-notation path
 */
function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Determine plural form based on count and locale
 * Uses Intl.PluralRules for locale-specific plural rules
 */
function getPluralForm(count: number, locale: Locale): PluralForm {
  const rules = new Intl.PluralRules(locale);
  return rules.select(count) as PluralForm;
}

/**
 * I18n Provider Component
 */
export function I18nProvider(props: { children: JSX.Element }) {
  const [locale, setLocaleSignal] = createSignal<Locale>(getInitialLocale());
  const [translations, setTranslations] = createSignal<Translations>(en);

  // Load translations when locale changes
  createEffect(() => {
    const currentLocale = locale();

    // Load translations asynchronously
    void loadTranslations(currentLocale).then((loadedTranslations) => {
      setTranslations(loadedTranslations);
    });

    // Set HTML lang attribute
    document.documentElement.lang = currentLocale;

    // Set RTL direction for Arabic
    const localeInfo = SUPPORTED_LOCALES.find((l) => l.code === currentLocale);
    if (localeInfo?.rtl) {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  });

  /**
   * Set locale and persist to localStorage
   */
  const setLocale = (newLocale: Locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    setLocaleSignal(newLocale);
  };

  /**
   * Translation function with parameter interpolation
   */
  const t = (
    key: TranslationKey,
    params?: Record<string, string | number>
  ): string => {
    const translation = getNestedValue(translations(), key);

    if (!translation) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }

    // If no params, return translation as-is
    if (!params) {
      return translation;
    }

    // Replace parameters in the translation
    return Object.entries(params).reduce(
      (result, [key, value]) => result.replace(`{{${key}}}`, String(value)),
      translation
    );
  };

  /**
   * Translation function with pluralization support
   *
   * Usage: tp('items.count', 5) => "5 items"
   *
   * Translation file should have:
   * {
   *   "items": {
   *     "count": {
   *       "one": "{{count}} item",
   *       "other": "{{count}} items"
   *     }
   *   }
   * }
   */
  const tp = (
    key: TranslationKey,
    count: number,
    params?: Record<string, string | number>
  ): string => {
    const pluralForms = getNestedValue(translations(), key);

    if (!pluralForms || typeof pluralForms !== 'object') {
      console.warn(`Plural translation missing for key: ${key}`);
      return key;
    }

    // Get the appropriate plural form for this locale
    const pluralForm = getPluralForm(count, locale());

    // Try to get translation for this plural form, fallback to 'other'
    let translation =
      (pluralForms as any)[pluralForm] || (pluralForms as any)['other'];

    if (!translation) {
      console.warn(`Plural form '${pluralForm}' missing for key: ${key}`);
      return key;
    }

    // Merge count with any additional params
    const allParams = { count, ...params };

    // Replace parameters
    return Object.entries(allParams).reduce(
      (result, [key, value]) => result.replace(`{{${key}}}`, String(value)),
      translation
    );
  };

  /**
   * Format a date according to the current locale
   *
   * @param date - Date object or ISO string
   * @param formatStr - Format string (e.g., 'PPP' for long date, 'Pp' for date + time)
   *                    Defaults to 'PPP' (e.g., "April 29, 1453" in English)
   */
  const formatDateFn = (
    date: Date | string,
    formatStr: string = 'PPP'
  ): string => {
    try {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      const dateFnsLocale = LOCALE_DATE_FNS_MAP[locale()];
      return formatDate(dateObj, formatStr, { locale: dateFnsLocale });
    } catch (error) {
      console.error('Error formatting date:', error);
      return String(date);
    }
  };

  /**
   * Format a number according to the current locale
   *
   * @param value - Number to format
   * @param options - Intl.NumberFormatOptions (e.g., { minimumFractionDigits: 2 })
   */
  const formatNumber = (
    value: number,
    options?: Intl.NumberFormatOptions
  ): string => {
    try {
      return new Intl.NumberFormat(locale(), options).format(value);
    } catch (error) {
      console.error('Error formatting number:', error);
      return String(value);
    }
  };

  /**
   * Format a currency value according to the current locale
   *
   * @param value - Number to format
   * @param currency - Currency code (e.g., 'USD', 'EUR'). Defaults to 'USD'
   * @param options - Additional Intl.NumberFormatOptions
   */
  const formatCurrency = (
    value: number,
    currency: string = 'USD',
    options?: Intl.NumberFormatOptions
  ): string => {
    try {
      return new Intl.NumberFormat(locale(), {
        style: 'currency',
        currency,
        ...options,
      }).format(value);
    } catch (error) {
      console.error('Error formatting currency:', error);
      return `${currency} ${value}`;
    }
  };

  const value: I18nContextValue = {
    locale,
    setLocale,
    t,
    tp,
    formatDate: formatDateFn,
    formatNumber,
    formatCurrency,
    translations,
  };

  return (
    <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>
  );
}

/**
 * Hook to access i18n context
 */
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
