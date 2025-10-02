# Dashboard Internationalization (i18n)

This directory contains the internationalization system for the Castmill Dashboard. The system is designed to be lightweight, type-safe, and AI-friendly for easy translation management.

## Features

- 🌍 Support for 9 languages (English, Spanish, Swedish, German, French, Chinese, Arabic, Korean, Japanese)
- 🔄 Automatic language detection from browser settings
- 💾 Language preference persistence in localStorage
- 🎯 Type-safe translation keys
- 🤖 AI-friendly JSON translation format
- ⚡ Dynamic translation loading (code-splitting)
- 🔀 RTL (Right-to-Left) support for Arabic
- 🔌 Simple React-like context API
- 📊 **Pluralization support** - Handle singular/plural forms correctly for each language
- 📅 **Date/time formatting** - Locale-aware date and time display using date-fns
- 🔢 **Number formatting** - Format numbers according to locale conventions
- 💰 **Currency formatting** - Display currency with proper symbols and formats

## Supported Languages

| Language           | Code | Native Name | RTL |
| ------------------ | ---- | ----------- | --- |
| English            | `en` | English     | No  |
| Spanish            | `es` | Español     | No  |
| Swedish            | `sv` | Svenska     | No  |
| German             | `de` | Deutsch     | No  |
| French             | `fr` | Français    | No  |
| Chinese (Mandarin) | `zh` | 中文        | No  |
| Arabic             | `ar` | العربية     | Yes |
| Korean             | `ko` | 한국어      | No  |
| Japanese           | `ja` | 日本語      | No  |

## Usage

### Basic Usage in Components

```tsx
import { useI18n } from '../../i18n';

function MyComponent() {
  const { t } = useI18n();

  return (
    <div>
      <h1>{t('common.settings')}</h1>
      <button>{t('common.save')}</button>
    </div>
  );
}
```

### Switching Language

```tsx
import { useI18n, SUPPORTED_LOCALES } from '../../i18n';

function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <select
      value={locale()}
      onChange={(e) => setLocale(e.target.value as Locale)}
    >
      {SUPPORTED_LOCALES.map((loc) => (
        <option value={loc.code}>{loc.nativeName}</option>
      ))}
    </select>
  );
}
```

### Translation Keys with Parameters

```tsx
// In your component
const message = t('greeting.hello', { name: 'John' });

// In translation file (en.json)
{
  "greeting": {
    "hello": "Hello, {{name}}!"
  }
}
```

### Pluralization

Handle singular/plural forms correctly:

```tsx
import { useI18n } from '../../i18n';

function ItemList() {
  const { tp } = useI18n();
  const itemCount = 5;

  return (
    <div>
      <p>{tp('plurals.items', itemCount)}</p>
      {/* Displays: "5 items" */}

      <p>{tp('plurals.items', 1)}</p>
      {/* Displays: "1 item" */}
    </div>
  );
}
```

Translation file structure for plurals:

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

The system automatically selects the correct plural form based on the locale's rules using `Intl.PluralRules`.

### Date and Time Formatting

Format dates according to locale conventions:

```tsx
import { useI18n } from '../../i18n';

function DateDisplay() {
  const { formatDate } = useI18n();
  const date = new Date('2024-01-15');

  return (
    <div>
      <p>{formatDate(date)}</p>
      {/* English: "January 15, 2024" */}
      {/* Spanish: "15 de enero de 2024" */}

      <p>{formatDate(date, 'PP')}</p>
      {/* Short date format */}

      <p>{formatDate(date, 'PPpp')}</p>
      {/* Date with time */}
    </div>
  );
}
```

Format strings follow [date-fns format patterns](https://date-fns.org/docs/format):

- `'PP'` - Medium date (e.g., "Apr 29, 1453")
- `'PPP'` - Long date (e.g., "April 29th, 1453")
- `'Pp'` - Medium date + time
- `'PPpp'` - Long date + time

### Number Formatting

Format numbers according to locale conventions:

```tsx
import { useI18n } from '../../i18n';

function Statistics() {
  const { formatNumber } = useI18n();

  return (
    <div>
      <p>{formatNumber(1234.56)}</p>
      {/* English: "1,234.56" */}
      {/* German: "1.234,56" */}

      <p>{formatNumber(0.85, { style: 'percent' })}</p>
      {/* "85%" */}

      <p>{formatNumber(1234.5, { minimumFractionDigits: 2 })}</p>
      {/* "1,234.50" */}
    </div>
  );
}
```

### Currency Formatting

Display currency with proper symbols and formats:

```tsx
import { useI18n } from '../../i18n';

function Price() {
  const { formatCurrency } = useI18n();

  return (
    <div>
      <p>{formatCurrency(99.99, 'USD')}</p>
      {/* English: "$99.99" */}
      {/* Spanish: "99,99 US$" */}

      <p>{formatCurrency(1234.56, 'EUR')}</p>
      {/* "€1,234.56" or "1.234,56 €" depending on locale */}

      <p>{formatCurrency(99.99, 'JPY', { minimumFractionDigits: 0 })}</p>
      {/* "¥100" (no decimals for JPY) */}
    </div>
  );
}
```

## Adding New Translations

### For Developers

1. Add the English text to `locales/en.json` first
2. Add corresponding translations to other language files
3. Use the translation key in your component with `t('key.path')`

### For AI Agents

The translation files are structured in a hierarchical JSON format for easy parsing:

```json
{
  "section": {
    "subsection": {
      "key": "Translation text"
    }
  }
}
```

To add a new translation:

1. Identify the appropriate section in `en.json`
2. Add your key-value pair
3. Copy the structure to all other language files
4. Translate the value to each target language
5. Maintain the exact same JSON structure across all files

## Translation File Structure

```
locales/
├── en.json  (English - Base language)
├── es.json  (Spanish)
├── sv.json  (Swedish)
├── de.json  (German)
├── fr.json  (French)
├── zh.json  (Chinese Mandarin)
├── ar.json  (Arabic - RTL)
├── ko.json  (Korean)
└── ja.json  (Japanese)
```

### Current Translation Sections

- `common` - Common UI elements (buttons, labels, etc.)
- `topbar` - Top navigation bar
- `settings` - Settings page
- `usage` - Usage page
- `teams` - Teams management
- `login` - Login page
- `errors` - Error messages

## Architecture

### Components

- **I18nProvider** - Context provider that wraps the entire application
- **useI18n()** - Hook to access translation functions
- **LanguageSelector** - UI component for language selection

### Key Files

- `i18n-context.tsx` - Main context and provider implementation
- `types.ts` - TypeScript types and constants
- `index.ts` - Public API exports
- `locales/` - Translation JSON files

## Testing

Tests are included in `i18n-context.test.tsx`:

```bash
yarn test i18n-context.test
```

## Best Practices

1. **Always use translation keys** - Never hardcode user-facing text
2. **Keep keys descriptive** - Use `settings.saveProfile` not `settings.btn1`
3. **Group by feature** - Organize translations by page/component
4. **Test all languages** - Verify translations load correctly
5. **Handle missing keys** - The system returns the key itself if translation is missing
6. **Consider context** - Same English word might need different translations in different contexts

## Adding a New Language

1. Add language info to `types.ts` in `SUPPORTED_LOCALES`
2. Create new JSON file in `locales/` (e.g., `locales/pt.json` for Portuguese)
3. Copy structure from `en.json`
4. Translate all values
5. Test the new language

## RTL (Right-to-Left) Support

Arabic is currently the only RTL language. The system automatically:

- Sets `dir="rtl"` on the HTML element
- Adjusts CSS for RTL layout (see `language-selector.scss` for examples)

To add more RTL languages (Hebrew, Farsi, etc.):

1. Add language to `SUPPORTED_LOCALES` with `rtl: true`
2. Create translation file
3. Test layout in RTL mode

## Performance

- Translation files are dynamically imported for code-splitting
- Only the selected language is loaded
- Language is cached in localStorage to avoid re-detection
- Initial render uses English while other languages load

## Troubleshooting

### Translation not showing

- Check if the key exists in the translation file
- Verify the component is wrapped in `I18nProvider`
- Look for console warnings about missing keys

### Language not persisting

- Check browser localStorage is enabled
- Verify `LOCALE_STORAGE_KEY` is not conflicting

### Tests failing with i18n

- Wrap test components in `I18nProvider`
- See `settings-page.test.tsx` for examples

## Preventing Non-Localized Content

To ensure all user-facing text is localized:

### 1. ESLint Rule (Recommended)

Add the `eslint-plugin-react` rule to detect hardcoded strings:

```json
// .eslintrc.json
{
  "plugins": ["react"],
  "rules": {
    "react/jsx-no-literals": [
      "warn",
      {
        "noStrings": true,
        "ignoreProps": true,
        "noAttributeStrings": true
      }
    ]
  }
}
```

This warns when JSX contains hardcoded strings instead of translations.

### 2. Code Review Checklist

When reviewing PRs, check for:

- [ ] All user-facing text uses `t()` function
- [ ] No hardcoded strings in JSX (e.g., `<button>Save</button>`)
- [ ] Translation keys added to all language files
- [ ] Tests updated to use `I18nProvider`

### 3. Automated Detection Script

Run this script to find potential hardcoded strings:

```bash
# Find JSX with hardcoded strings
grep -r ">[A-Z]" src --include="*.tsx" | grep -v "import" | grep -v "//"
```

### 4. Developer Guidelines

**DO:**

```tsx
// ✅ Use translation function
<button>{t('common.save')}</button>
<h1>{t('settings.title')}</h1>
```

**DON'T:**

```tsx
// ❌ Hardcoded strings
<button>Save</button>
<h1>Settings</h1>
```

### 5. Component Template

Use this template for new components:

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

## Complete Internationalization Features

### Implemented ✅

- [x] **Text translation** with parameter interpolation
- [x] **Pluralization** - Automatic singular/plural forms based on locale rules
- [x] **Date/time formatting** - Locale-aware date display with date-fns
- [x] **Number formatting** - Format numbers according to locale conventions
- [x] **Currency formatting** - Display currency with proper symbols and formats
- [x] **RTL support** - Right-to-left layout for Arabic
- [x] **Type-safe translations** - TypeScript support throughout
- [x] **Comprehensive tests** - Full test coverage for all features

### API Reference

```typescript
const {
  locale, // Accessor<Locale> - Current locale
  setLocale, // (locale: Locale) => void - Change language
  t, // (key, params?) => string - Translate text
  tp, // (key, count, params?) => string - Pluralized translation
  formatDate, // (date, format?) => string - Format date/time
  formatNumber, // (value, options?) => string - Format numbers
  formatCurrency, // (value, currency?, options?) => string - Format currency
  translations, // Accessor<Translations> - Current translations object
} = useI18n();
```

## Future Enhancements

Potential improvements for the i18n system:

- [ ] Translation management UI - Web interface for managing translations
- [ ] Automated translation detection for untranslated keys
- [ ] Translation validation scripts
- [ ] ESLint rule integration for enforcing translations
- [ ] Relative time formatting (e.g., "3 days ago")
- [ ] List formatting (e.g., "apples, oranges, and bananas")
- [ ] Message formatting with nested interpolation
