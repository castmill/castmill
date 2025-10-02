/**
 * Language Selector Component
 *
 * Dropdown component for selecting the application language
 */

import { Component, For, createSignal, Show } from 'solid-js';
import { useI18n, SUPPORTED_LOCALES, Locale } from '../../i18n';
import './language-selector.scss';

interface LanguageSelectorProps {
  compact?: boolean;
}

const LanguageSelector: Component<LanguageSelectorProps> = (props) => {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = createSignal(false);

  const currentLocale = () =>
    SUPPORTED_LOCALES.find((l) => l.code === locale());

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    setIsOpen(false);
  };

  return (
    <div class="language-selector" classList={{ compact: props.compact }}>
      <button
        class="language-selector__trigger"
        onClick={() => setIsOpen(!isOpen())}
        aria-label={t('common.language')}
      >
        <span class="language-selector__current">
          {props.compact
            ? currentLocale()?.code.toUpperCase()
            : currentLocale()?.nativeName}
        </span>
        <span class="language-selector__arrow">▼</span>
      </button>

      <Show when={isOpen()}>
        <div class="language-selector__dropdown">
          <For each={SUPPORTED_LOCALES}>
            {(localeInfo) => (
              <button
                class="language-selector__option"
                classList={{ active: locale() === localeInfo.code }}
                onClick={() => handleLocaleChange(localeInfo.code)}
              >
                <span class="language-selector__code">
                  {localeInfo.code.toUpperCase()}
                </span>
                <span class="language-selector__name">
                  {localeInfo.nativeName}
                </span>
                <Show when={locale() === localeInfo.code}>
                  <span class="language-selector__check">✓</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default LanguageSelector;
