/**
 * Overflow ("more") menu for the compact top bar. Holds the secondary
 * actions that don't fit on small screens: onboarding, theme, language,
 * help and (on devices with a keyboard) the shortcuts legend.
 */
import {
  Component,
  For,
  Show,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js';
import {
  TbDotsVertical,
  TbHelpCircle,
  TbKeyboard,
  TbLanguage,
  TbMoon,
  TbRocket,
  TbSun,
} from 'solid-icons/tb';
import { useI18n, SUPPORTED_LOCALES, Locale } from '../../i18n';
import { useTheme } from '../../theme';

export const OVERFLOW_MENU_ID = 'castmill-topbar-overflow';

interface TopbarOverflowMenuProps {
  /** Label of the onboarding entry, including progress. */
  onboardingLabel: string;
  /** Pulse the trigger while the onboarding tour points at the guide. */
  highlight?: boolean;
  onStartOnboarding: () => void;
  onLanguageChange?: (locale: Locale) => void;
  /** Omitted on touch devices, which hides the shortcuts entry. */
  onShowShortcuts?: () => void;
}

const TopbarOverflowMenu: Component<TopbarOverflowMenuProps> = (props) => {
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = createSignal(false);

  let rootRef: HTMLDivElement | undefined;
  let triggerRef: HTMLButtonElement | undefined;
  let selectRef: HTMLSelectElement | undefined;

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef?.focus();
  };

  const handlePointerDown = (event: Event) => {
    if (open() && rootRef && !rootRef.contains(event.target as Node)) {
      close();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (open() && event.key === 'Escape') {
      event.stopPropagation();
      close(true);
    }
  };

  onMount(() => {
    document.addEventListener('pointerdown', handlePointerDown);
    onCleanup(() =>
      document.removeEventListener('pointerdown', handlePointerDown)
    );
  });

  const run = (action: () => void) => () => {
    close(true);
    action();
  };

  const themeLabel = () =>
    theme() === 'dark'
      ? t('topbar.switchToLightMode')
      : t('topbar.switchToDarkMode');

  // While closed, the root stands in for the language selector so the
  // onboarding tour can find it; the tour's click opens the menu and focuses
  // the select.
  const handleRootClick = (event: MouseEvent) => {
    if (event.target !== rootRef) return;
    setOpen(true);
    selectRef?.focus();
  };

  return (
    <div
      class="topbar-overflow"
      ref={rootRef}
      onKeyDown={handleKeyDown}
      onClick={handleRootClick}
      data-onboarding={open() ? undefined : 'language-selector'}
      data-testid="topbar-overflow"
    >
      <button
        ref={triggerRef}
        type="button"
        class="topbar-icon-button topbar-overflow__trigger"
        classList={{ 'animate-pulse': !!props.highlight }}
        data-onboarding="getting-started"
        aria-label={t('topbar.moreOptions')}
        title={t('topbar.moreOptions')}
        aria-haspopup="true"
        aria-expanded={open()}
        aria-controls={OVERFLOW_MENU_ID}
        onClick={() => setOpen(!open())}
      >
        <TbDotsVertical />
      </button>
      <Show when={open()}>
        <div id={OVERFLOW_MENU_ID} class="topbar-overflow__menu">
          <button
            type="button"
            class="topbar-overflow__item"
            onClick={run(props.onStartOnboarding)}
          >
            <TbRocket aria-hidden="true" />
            <span>{props.onboardingLabel}</span>
          </button>
          <button
            type="button"
            class="topbar-overflow__item"
            onClick={run(toggleTheme)}
            data-testid="overflow-theme-toggle"
          >
            <Show when={theme() === 'dark'} fallback={<TbMoon />}>
              <TbSun />
            </Show>
            <span>{themeLabel()}</span>
          </button>
          <label class="topbar-overflow__item topbar-overflow__language">
            <TbLanguage aria-hidden="true" />
            <span>{t('common.language')}</span>
            <select
              ref={selectRef}
              data-onboarding="language-selector"
              value={locale()}
              onChange={(event) => {
                const next = event.currentTarget.value as Locale;
                setLocale(next);
                props.onLanguageChange?.(next);
                close(true);
              }}
            >
              <For each={SUPPORTED_LOCALES}>
                {(info) => (
                  <option value={info.code} selected={locale() === info.code}>
                    {info.nativeName}
                  </option>
                )}
              </For>
            </select>
          </label>
          <a
            class="topbar-overflow__item"
            href="https://docs.castmill.io"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => close(true)}
          >
            <TbHelpCircle aria-hidden="true" />
            <span>{t('topbar.help')}</span>
          </a>
          <Show when={props.onShowShortcuts}>
            <button
              type="button"
              class="topbar-overflow__item"
              onClick={run(() => props.onShowShortcuts?.())}
            >
              <TbKeyboard aria-hidden="true" />
              <span>{t('shortcuts.showShortcutsLegend')}</span>
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default TopbarOverflowMenu;
