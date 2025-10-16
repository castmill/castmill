import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@solidjs/testing-library';
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

    // Wait for locale to change
    await waitFor(() => {
      expect(screen.getByTestId('current-locale').textContent).toBe('es');
    });

    // Wait for Spanish translation to load
    await waitFor(
      () => {
        expect(screen.getByTestId('translation').textContent).toBe('Guardar');
      },
      { timeout: 1000 }
    );
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

  it('supports pluralization', () => {
    function PluralComponent() {
      const { tp } = useI18n();
      return (
        <div>
          <div data-testid="plural-one">{tp('plurals.items', 1)}</div>
          <div data-testid="plural-many">{tp('plurals.items', 5)}</div>
        </div>
      );
    }

    render(() => (
      <I18nProvider>
        <PluralComponent />
      </I18nProvider>
    ));

    expect(screen.getByTestId('plural-one').textContent).toBe('1 item');
    expect(screen.getByTestId('plural-many').textContent).toBe('5 items');
  });

  it('formats numbers correctly', () => {
    function NumberComponent() {
      const { formatNumber } = useI18n();
      return (
        <div data-testid="number">
          {formatNumber(1234.56, { minimumFractionDigits: 2 })}
        </div>
      );
    }

    render(() => (
      <I18nProvider>
        <NumberComponent />
      </I18nProvider>
    ));

    // English locale formats as 1,234.56
    expect(screen.getByTestId('number').textContent).toMatch(/1[,\s]234\.56/);
  });

  it('formats currency correctly', () => {
    function CurrencyComponent() {
      const { formatCurrency } = useI18n();
      return <div data-testid="currency">{formatCurrency(99.99, 'USD')}</div>;
    }

    render(() => (
      <I18nProvider>
        <CurrencyComponent />
      </I18nProvider>
    ));

    // Should include currency symbol and amount
    const text = screen.getByTestId('currency').textContent;
    expect(text).toContain('99.99');
    expect(text).toMatch(/\$|USD/);
  });

  it('formats dates correctly', () => {
    function DateComponent() {
      const { formatDate } = useI18n();
      return <div data-testid="date">{formatDate(new Date('2024-01-15'))}</div>;
    }

    render(() => (
      <I18nProvider>
        <DateComponent />
      </I18nProvider>
    ));

    // English locale formats as "January 15, 2024"
    const text = screen.getByTestId('date').textContent;
    expect(text).toContain('January');
    expect(text).toContain('15');
    expect(text).toContain('2024');
  });
});
