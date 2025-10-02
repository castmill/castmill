/**
 * I18n Context and Provider for the Dashboard
 *
 * Provides translation functions and locale management throughout the app.
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
} from './types';

// Import all translation files
import en from './locales/en.json';

// Translation type based on English translations
export type Translations = typeof en;

// Translation key paths (for type-safety)
export type TranslationKey = string;

interface I18nContextValue {
  locale: Accessor<Locale>;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
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
  const browserLang = navigator.language.split('-')[0];
  if (SUPPORTED_LOCALES.some((l) => l.code === browserLang)) {
    return browserLang as Locale;
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
 * I18n Provider Component
 */
export function I18nProvider(props: { children: JSX.Element }) {
  const [locale, setLocaleSignal] = createSignal<Locale>(getInitialLocale());
  const [translations, setTranslations] = createSignal<Translations>(en);

  // Load translations when locale changes
  createEffect(async () => {
    const currentLocale = locale();
    const loadedTranslations = await loadTranslations(currentLocale);
    setTranslations(loadedTranslations);

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

  const value: I18nContextValue = {
    locale,
    setLocale,
    t,
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
