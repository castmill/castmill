import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@solidjs/testing-library';
import { I18nProvider, useI18n } from './i18n-context';
import { LOCALE_STORAGE_KEY } from './types';

// Test component that uses i18n
function TestComponent() {
  const { t, locale, setLocale } = useI18n();

  return (
    <div>
      <div data-testid="current-locale">{locale()}</div>
      <div data-testid="translation">{t('common.save')}</div>
      <button data-testid="change-locale" onClick={() => setLocale('es')}>
        Change to Spanish
      </button>
    </div>
  );
}

describe('I18n Context', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with default locale (English)', () => {
    render(() => (
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    ));

    expect(screen.getByTestId('current-locale').textContent).toBe('en');
    expect(screen.getByTestId('translation').textContent).toBe('Save');
  });

  it('persists locale to localStorage', async () => {
    render(() => (
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    ));

    // Initially English
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();

    // Change to Spanish
    const button = screen.getByTestId('change-locale');
    button.click();

    // Wait for effects to run
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check localStorage was updated
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
  });

  it('translates to correct language', async () => {
    render(() => (
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    ));

    // Change to Spanish
    const button = screen.getByTestId('change-locale');
    button.click();

    // Wait for translations to load
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(screen.getByTestId('current-locale').textContent).toBe('es');
    // Spanish translation should be loaded
    expect(screen.getByTestId('translation').textContent).toBe('Guardar');
  });

  it('handles missing translation keys gracefully', () => {
    function MissingKeyComponent() {
      const { t } = useI18n();
      return <div data-testid="missing">{t('nonexistent.key')}</div>;
    }

    render(() => (
      <I18nProvider>
        <MissingKeyComponent />
      </I18nProvider>
    ));

    // Should return the key itself when translation is missing
    expect(screen.getByTestId('missing').textContent).toBe('nonexistent.key');
  });

  it('supports nested translation keys', () => {
    function NestedComponent() {
      const { t } = useI18n();
      return <div data-testid="nested">{t('settings.title')}</div>;
    }

    render(() => (
      <I18nProvider>
        <NestedComponent />
      </I18nProvider>
    ));

    expect(screen.getByTestId('nested').textContent).toBe('Settings');
  });
});
