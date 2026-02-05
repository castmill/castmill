/**
 * Language Selector Component
 *
 * Dropdown component for selecting the application language
 * Displays languages in their native form
 */

import { Component, For } from 'solid-js';
import { useI18n, SUPPORTED_LOCALES, Locale } from '../../i18n';
import DropdownMenu from '../dropdown-menu/dropdown-menu';
import './language-selector.scss';

interface LanguageSelectorProps {
  compact?: boolean;
  onLanguageChange?: (locale: Locale) => void;
}

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
          <span class="language-selector__native-name">
            {currentLocale()?.nativeName || 'English'}
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
            <span class="language-selector__name">{localeInfo.nativeName}</span>
          </button>
        )}
      </For>
    </DropdownMenu>
  );
};

export default LanguageSelector;
