# Dashboard Internationalization (i18n) - Agent Guide

This guide provides comprehensive information about internationalization in the Castmill Dashboard to help AI agents maintain proper i18n standards across all PRs.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Critical Rules](#critical-rules)
3. [i18n System Architecture](#i18n-system-architecture)
4. [Usage Patterns](#usage-patterns)
5. [Translation Workflow](#translation-workflow)
6. [Testing Requirements](#testing-requirements)
7. [Common Pitfalls](#common-pitfalls)
8. [Validation Tools](#validation-tools)

---

## Overview

The Dashboard is **fully internationalized** with support for 9 languages. Every user-facing string must be localized. The system provides:

- **Text translation** with parameter interpolation
- **Pluralization** with locale-specific rules
- **Date/time formatting** with locale awareness
- **Number formatting** per locale conventions
- **Currency formatting** with proper symbols
- **RTL support** for Arabic

### Supported Languages

| Code | Language | Native Name | Coverage | RTL |
| ---- | -------- | ----------- | -------- | --- |
| `en` | English  | English     | 100%     | No  |
| `es` | Spanish  | Español     | 100%     | No  |
| `sv` | Swedish  | Svenska     | 100%     | No  |
| `de` | German   | Deutsch     | 100%     | No  |
| `fr` | French   | Français    | 100%     | No  |
| `zh` | Chinese  | 中文        | 100%     | No  |
| `ar` | Arabic   | العربية     | 100%     | Yes |
| `ko` | Korean   | 한국어      | 100%     | No  |
| `ja` | Japanese | 日本語      | 100%     | No  |

---

## Critical Rules

### ⚠️ MANDATORY: All User-Facing Text Must Be Localized

**❌ NEVER do this:**

```tsx
<button>Save</button>
<h1>Settings</h1>
<p>Loading...</p>
```

**✅ ALWAYS do this:**

```tsx
const { t } = useI18n();

<button>{t('common.save')}</button>
<h1>{t('settings.title')}</h1>
<p>{t('common.loading')}</p>
```

### ⚠️ MANDATORY: Add Translations to ALL Languages

When adding a new translation key:

1. **Add to English first** (`locales/en.json`) - this is the reference
2. **Add to all 8 other languages** - never leave a language incomplete
3. **Use proper translations** - don't just copy English to other languages
4. **Run validation** - use `yarn check-translations` before committing

### ⚠️ MANDATORY: Use Proper i18n Functions

Choose the right function for the job:

| Use Case         | Function                   | Example                          |
| ---------------- | -------------------------- | -------------------------------- |
| Simple text      | `t(key)`                   | `t('common.save')`               |
| Text with params | `t(key, params)`           | `t('welcome', { name: 'John' })` |
| Plurals          | `tp(key, count)`           | `tp('plurals.items', 5)`         |
| Dates            | `formatDate(date)`         | `formatDate(new Date())`         |
| Numbers          | `formatNumber(num)`        | `formatNumber(1234.56)`          |
| Currency         | `formatCurrency(val, cur)` | `formatCurrency(99.99, 'USD')`   |

---

## i18n System Architecture

### File Structure

```
packages/dashboard/src/i18n/
├── i18n-context.tsx          # Main provider and hooks
├── types.ts                  # TypeScript types and locale mappings
├── index.ts                  # Public exports
├── README.md                 # Detailed documentation
├── i18n-context.test.tsx     # Comprehensive tests
└── locales/                  # Translation files
    ├── en.json              # English (reference)
    ├── es.json              # Spanish
    ├── sv.json              # Swedish
    ├── de.json              # German
    ├── fr.json              # French
    ├── zh.json              # Chinese
    ├── ar.json              # Arabic (RTL)
    ├── ko.json              # Korean
    └── ja.json              # Japanese
```

### Core Components

#### 1. I18nProvider

Wraps the entire application and provides i18n context.

```tsx
// In src/index.tsx
<I18nProvider>
  <App />
</I18nProvider>
```

#### 2. useI18n Hook

Primary interface for accessing i18n functions.

```tsx
import { useI18n } from '../../i18n';

const {
  locale, // Current locale (Accessor<Locale>)
  setLocale, // Change language
  t, // Translate text
  tp, // Translate with pluralization
  formatDate, // Format dates
  formatNumber, // Format numbers
  formatCurrency, // Format currency
  translations, // Raw translations object
} = useI18n();
```

#### 3. Language Selector

UI component for switching languages.

```tsx
import LanguageSelector from '../../components/language-selector/language-selector';

<LanguageSelector />;
```

---

## Usage Patterns

### 1. Basic Translation

```tsx
import { useI18n } from '../../i18n';

function MyComponent() {
  const { t } = useI18n();

  return (
    <div>
      <h1>{t('myComponent.title')}</h1>
      <button>{t('common.save')}</button>
    </div>
  );
}
```

**Translation file (en.json):**

```json
{
  "myComponent": {
    "title": "My Component"
  },
  "common": {
    "save": "Save"
  }
}
```

### 2. Translation with Parameters

```tsx
const { t } = useI18n();
const userName = 'Alice';

<p>{t('greeting.hello', { name: userName })}</p>;
// Output: "Hello, Alice!"
```

**Translation file:**

```json
{
  "greeting": {
    "hello": "Hello, {{name}}!"
  }
}
```

### 3. Pluralization

```tsx
const { tp } = useI18n();
const itemCount = 5;

<p>{tp('plurals.items', itemCount)}</p>;
// English: "5 items"
// German: "5 Artikel"
```

**Translation file:**

```json
{
  "plurals": {
    "items": {
      "one": "{{count}} item",
      "other": "{{count}} items"
    }
  }
}
```

### 4. Date Formatting

```tsx
const { formatDate } = useI18n();

<p>{formatDate(new Date('2024-01-15'))}</p>
// English: "January 15, 2024"
// Spanish: "15 de enero de 2024"

<p>{formatDate(new Date(), 'PP')}</p>
// Short format: "Jan 15, 2024"
```

### 5. Number Formatting

```tsx
const { formatNumber } = useI18n();

<p>{formatNumber(1234.56)}</p>
// English: "1,234.56"
// German: "1.234,56"

<p>{formatNumber(0.85, { style: 'percent' })}</p>
// Output: "85%"
```

### 6. Currency Formatting

```tsx
const { formatCurrency } = useI18n();

<p>{formatCurrency(99.99, 'USD')}</p>
// English: "$99.99"
// Spanish: "99,99 US$"

<p>{formatCurrency(1234.56, 'EUR')}</p>
// English: "€1,234.56"
// German: "1.234,56 €"
```

---

## Translation Workflow

### Adding New Features with i18n

When adding a new component or feature:

1. **Identify all user-facing text**
   - Buttons, labels, headings, messages
   - Error messages, tooltips, placeholders
   - Table headers, form labels

2. **Add keys to English first**

   ```json
   // locales/en.json
   {
     "myFeature": {
       "title": "My Feature",
       "description": "This is my feature",
       "actions": {
         "submit": "Submit",
         "cancel": "Cancel"
       }
     }
   }
   ```

3. **Add translations to all languages**
   - Spanish, Swedish, German, French, Chinese, Arabic, Korean, Japanese
   - Use proper translations (not just English)
   - Maintain the same JSON structure

4. **Use translations in component**

   ```tsx
   const { t } = useI18n();

   <div>
     <h1>{t('myFeature.title')}</h1>
     <p>{t('myFeature.description')}</p>
     <button>{t('myFeature.actions.submit')}</button>
   </div>;
   ```

5. **Validate before committing**
   ```bash
   yarn check-translations
   ```

### Translation File Organization

Organize translations by feature/page:

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "topbar": {
    "help": "Help",
    "profile": "Profile"
  },
  "settings": {
    "title": "Settings",
    "profile": "Profile Information"
  },
  "plurals": {
    "items": {
      "one": "{{count}} item",
      "other": "{{count}} items"
    }
  }
}
```

---

## Testing Requirements

### 1. Component Tests with i18n

All component tests must wrap components in `I18nProvider`:

```tsx
import { render, screen } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import MyComponent from './my-component';

describe('MyComponent', () => {
  it('renders with translations', () => {
    render(() => (
      <I18nProvider>
        <MyComponent />
      </I18nProvider>
    ));

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
```

### 2. Testing Language Switching

```tsx
it('switches language correctly', async () => {
  function TestComponent() {
    const { locale, setLocale, t } = useI18n();

    return (
      <div>
        <button onClick={() => setLocale('es')}>Switch to Spanish</button>
        <p data-testid="translation">{t('common.save')}</p>
      </div>
    );
  }

  render(() => (
    <I18nProvider>
      <TestComponent />
    </I18nProvider>
  ));

  // Initially English
  expect(screen.getByTestId('translation').textContent).toBe('Save');

  // Switch to Spanish
  fireEvent.click(screen.getByText('Switch to Spanish'));
  await waitFor(() => {
    expect(screen.getByTestId('translation').textContent).toBe('Guardar');
  });
});
```

### 3. i18n Function Tests

Test all i18n functions:

```tsx
it('formats plurals correctly', () => {
  function TestComponent() {
    const { tp } = useI18n();
    return (
      <div>
        <p data-testid="one">{tp('plurals.items', 1)}</p>
        <p data-testid="many">{tp('plurals.items', 5)}</p>
      </div>
    );
  }

  render(() => (
    <I18nProvider>
      <TestComponent />
    </I18nProvider>
  ));

  expect(screen.getByTestId('one').textContent).toBe('1 item');
  expect(screen.getByTestId('many').textContent).toBe('5 items');
});
```

---

## Common Pitfalls

### ❌ Pitfall 1: Hardcoded Strings

```tsx
// WRONG
<button>Save Changes</button>;

// CORRECT
const { t } = useI18n();
<button>{t('common.saveChanges')}</button>;
```

### ❌ Pitfall 2: Missing Translations in Some Languages

```bash
# This will fail CI
# Only adding to English:
locales/en.json: "newFeature.title": "New Feature"

# MUST add to all languages:
locales/es.json: "newFeature.title": "Nueva Función"
locales/de.json: "newFeature.title": "Neue Funktion"
# ... and 6 more
```

### ❌ Pitfall 3: Not Using Pluralization

```tsx
// WRONG - doesn't handle singular/plural
<p>{count} items</p>;

// CORRECT - uses locale-specific plural rules
const { tp } = useI18n();
<p>{tp('plurals.items', count)}</p>;
```

### ❌ Pitfall 4: Manual Date/Number Formatting

```tsx
// WRONG - not locale-aware
<p>{date.toLocaleDateString()}</p>
<p>${price.toFixed(2)}</p>

// CORRECT - uses proper locale formatting
const { formatDate, formatCurrency } = useI18n();
<p>{formatDate(date)}</p>
<p>{formatCurrency(price, 'USD')}</p>
```

### ❌ Pitfall 5: Forgetting i18n in Tests

```tsx
// WRONG - component will crash
render(() => <MyComponent />);

// CORRECT - wrap in I18nProvider
render(() => (
  <I18nProvider>
    <MyComponent />
  </I18nProvider>
));
```

---

## Validation Tools

### 1. Translation Coverage Check

**Script**: `scripts/check-missing-translations.cjs`

```bash
# Check all languages
yarn check-translations

# Check specific language
yarn check-translations es
yarn check-translations de
```

This script:

- Compares all languages against English reference
- Identifies missing keys
- Detects untranslated strings (same as English)
- Fails CI if translations are incomplete

### 2. Local Validation

Before committing:

```bash
# 1. Check translations
cd packages/dashboard
yarn check-translations

# 2. Run tests
yarn test

# 3. Build
yarn build
```

### 3. CI/CD Validation

GitHub Actions automatically:

- Runs translation coverage check on every PR
- Fails if any language is incomplete
- Posts detailed report as PR comment
- Shows coverage in workflow summary

**Workflow**: `.github/workflows/check-translations.yml`

### 4. Understanding the Coverage Report

```
Language    Coverage    Missing    Untranslated    Status
----------------------------------------------------------
ES          100%        0          0               ✓ Complete
SV          97.6%       0          7               ⚠ Incomplete
```

- **Coverage**: Percentage of translated keys
- **Missing**: Keys that don't exist in the file
- **Untranslated**: Keys with same value as English
- **Status**: ✓ Complete or ⚠ Incomplete

---

## Quick Reference

### When Adding New Code

1. **Check**: Does it have user-facing text? → Use i18n
2. **Add**: Translation keys to `locales/en.json`
3. **Translate**: Add to all 8 other language files
4. **Use**: `const { t } = useI18n()` and `t('key')`
5. **Test**: Wrap test components in `I18nProvider`
6. **Validate**: Run `yarn check-translations`

### i18n Hook Functions

```tsx
const {
  locale, // Current language code
  setLocale, // Change language
  t, // Translate text
  tp, // Translate with plurals
  formatDate, // Format dates
  formatNumber, // Format numbers
  formatCurrency, // Format currency
  translations, // Raw translations
} = useI18n();
```

### Common Translation Keys

Already defined in all languages:

- `common.save`, `common.cancel`, `common.delete`
- `common.edit`, `common.add`, `common.remove`
- `common.close`, `common.confirm`, `common.back`
- `common.search`, `common.loading`, `common.error`
- `topbar.help`, `topbar.notifications`
- `settings.*`, `usage.*`, `teams.*`
- `plurals.items`, `plurals.users`, `plurals.devices`

### File Locations

- **i18n implementation**: `src/i18n/`
- **Translation files**: `src/i18n/locales/`
- **Language selector**: `src/components/language-selector/`
- **Validation script**: `scripts/check-missing-translations.cjs`
- **Documentation**: `src/i18n/README.md`
- **This guide**: `AGENTS.md` (you are here)

---

## Additional Resources

- **Detailed API docs**: `src/i18n/README.md`
- **Root AGENTS.md**: `../../AGENTS.md` (i18n section)
- **date-fns formats**: https://date-fns.org/docs/format
- **Intl API**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl

---

## Maintaining i18n Standards

### For Every PR

1. ✅ All user-facing text uses `t()` or other i18n functions
2. ✅ New translation keys added to ALL 9 languages
3. ✅ Tests wrapped in `I18nProvider`
4. ✅ `yarn check-translations` passes locally
5. ✅ CI translation check passes

### Red Flags to Watch For

🚩 Hardcoded strings in JSX: `<button>Click me</button>`  
🚩 Missing from some languages: Only in `en.json`  
🚩 Copy-paste translations: Same text in all languages  
🚩 Test failures: "useI18n must be used within an I18nProvider"  
🚩 CI failures: "Translation check failed: X strings are untranslated"

### Success Criteria

✅ All text localized  
✅ All languages 100% complete  
✅ All tests passing  
✅ CI checks passing  
✅ Proper i18n functions used

---

**Remember**: Internationalization is not optional. Every user-facing string must be localized for all 9 supported languages. The translation coverage check in CI will enforce this standard.
