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

## Supported Languages

| Language | Code | Native Name | RTL |
|----------|------|-------------|-----|
| English | `en` | English | No |
| Spanish | `es` | Español | No |
| Swedish | `sv` | Svenska | No |
| German | `de` | Deutsch | No |
| French | `fr` | Français | No |
| Chinese (Mandarin) | `zh` | 中文 | No |
| Arabic | `ar` | العربية | Yes |
| Korean | `ko` | 한국어 | No |
| Japanese | `ja` | 日本語 | No |

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

While the current implementation doesn't require parameters, the system supports them:

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

## Future Enhancements

Potential improvements for the i18n system:

- [ ] Pluralization support
- [ ] Date/time formatting per locale
- [ ] Number formatting per locale
- [ ] Translation management UI
- [ ] Automated translation detection for untranslated keys
- [ ] Translation validation scripts
- [ ] Support for nested parameter interpolation
