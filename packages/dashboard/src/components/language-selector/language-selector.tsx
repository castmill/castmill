/**
 * Language Selector Component
 *
 * Dropdown component for selecting the application language
 * Uses the shared DropdownMenu component with flag icons
 */

import { Component, For } from 'solid-js';
import { useI18n, SUPPORTED_LOCALES, Locale } from '../../i18n';
import DropdownMenu from '../dropdown-menu/dropdown-menu';
import './language-selector.scss';

interface LanguageSelectorProps {
  compact?: boolean;
  onLanguageChange?: (locale: Locale) => void;
}

// Flag emoji mapping for each language
const LANGUAGE_FLAGS: Record<string, string> = {
  en: '🇬🇧',
  es: '🇪🇸',
  sv: '🇸🇪',
  de: '🇩🇪',
  fr: '🇫🇷',
  zh: '🇨🇳',
  ar: '🇸🇦',
  ko: '🇰🇷',
  ja: '🇯🇵',
};

const LanguageSelector: Component<LanguageSelectorProps> = (props) => {
  const { locale, setLocale } = useI18n();

  const currentLocale = () =>
    SUPPORTED_LOCALES.find((l) => l.code === locale());

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    props.onLanguageChange?.(newLocale);
  };

  return (
    <DropdownMenu
      ButtonComponent={() => (
        <div
          class="language-selector__button"
          data-onboarding="language-selector"
        >
          <span class="language-selector__flag">
            {LANGUAGE_FLAGS[currentLocale()?.code || 'en']}
          </span>
        </div>
      )}
    >
      <For each={SUPPORTED_LOCALES}>
        {(localeInfo) => (
          <button
            class="language-selector__option"
            classList={{ active: locale() === localeInfo.code }}
            onClick={() => handleLocaleChange(localeInfo.code)}
          >
            <div class="language-selector__option-content">
              <span class="language-selector__flag">
                {LANGUAGE_FLAGS[localeInfo.code]}
              </span>
              <span class="language-selector__name">
                {localeInfo.nativeName}
              </span>
            </div>
          </button>
        )}
      </For>
    </DropdownMenu>
  );
};

export default LanguageSelector;
