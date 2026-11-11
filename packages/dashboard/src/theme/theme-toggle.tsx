import { Component, Show } from 'solid-js';
import { TbMoon, TbSun } from 'solid-icons/tb';
import { useI18n } from '../i18n';
import { useTheme } from './theme-context';
import './theme-toggle.scss';

/**
 * Topbar button that switches between light and dark mode.
 */
export const ThemeToggle: Component = () => {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();

  const label = () =>
    theme() === 'dark'
      ? t('topbar.switchToLightMode')
      : t('topbar.switchToDarkMode');

  return (
    <button
      type="button"
      class="theme-toggle"
      classList={{ 'theme-toggle--light': theme() === 'light' }}
      onClick={toggleTheme}
      title={label()}
      aria-label={label()}
      aria-pressed={theme() === 'light'}
      data-testid="theme-toggle"
    >
      {/* Each icon gets its own span so the spin-in animation replays. */}
      <Show
        when={theme() === 'dark'}
        fallback={
          <span class="theme-toggle__icon" aria-hidden="true">
            <TbMoon />
          </span>
        }
      >
        <span class="theme-toggle__icon" aria-hidden="true">
          <TbSun />
        </span>
      </Show>
    </button>
  );
};
