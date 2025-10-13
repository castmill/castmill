# Castmill Development Guide for AI Agents

This document provides AI agents with essential information about the Castmill platform's architecture, development patterns, and key implementations to work efficiently on the codebase.

## Platform Overview

Castmill is an open-source digital signage platform consisting of:
- **Backend**: Elixir/Phoenix server providing REST API and real-time features
- **Dashboard**: SolidJS frontend application for content management
- **Player**: SolidJS application for content playback on devices
- **Device Integration**: Support for WebOS, Android, and web-based players

## Architecture

### Monorepo Structure
```
packages/
├── castmill/          # Main Elixir/Phoenix backend server
├── dashboard/         # SolidJS admin dashboard
├── player/           # SolidJS content player
├── device/           # Device-specific implementations
├── ui-common/        # Shared UI components
├── cache/            # Caching utilities
├── widged/           # Widget development tools
└── platforms/        # Platform-specific players (WebOS, etc.)
```

### Key Technologies
- **Backend**: Elixir, Phoenix, PostgreSQL, Ecto
- **Frontend**: SolidJS, TypeScript, SCSS
- **Build Tools**: Vite, ESBuild, Tailwind CSS
- **Real-time**: Phoenix Channels, WebSockets
- **Testing**: ExUnit (backend), Vitest (frontend)

## Internationalization (i18n) System

### Overview
The dashboard implements a comprehensive internationalization system supporting 9 languages with advanced features including pluralization, date/time formatting, number formatting, and currency formatting.

### Supported Languages
1. **English (en)** - Base language
2. **Spanish (es)**
3. **Swedish (sv)**
4. **German (de)**
5. **French (fr)**
6. **Chinese Mandarin (zh)**
7. **Arabic (ar)** - RTL support
8. **Korean (ko)**
9. **Japanese (ja)**

### i18n Architecture

#### Provider Structure
```typescript
// App wrapped with I18nProvider at root level
<I18nProvider>
  <ToastProvider>
    <Router>
      {/* App content */}
    </Router>
  </ToastProvider>
</I18nProvider>
```

#### Core Hook
```typescript
import { useI18n } from './i18n';

const { t, tp, formatDate, formatNumber, formatCurrency, locale, setLocale } = useI18n();
```

### Translation Functions

#### Basic Translation
```typescript
t('key.path')                           // Simple translation
t('key.path', { name: 'John' })        // With parameters
```

#### Pluralization
```typescript
tp('plurals.items', count)              // Locale-aware pluralization
tp('plurals.items', 5, { type: 'media' })  // With additional parameters
```

#### Formatting Functions
```typescript
formatDate(new Date())                  // Locale-specific date format
formatDate(date, 'short')              // Custom format using date-fns
formatNumber(1234.56)                  // "1,234.56" / "1.234,56" (de)
formatCurrency(99.99, 'USD')           // "$99.99" / "99,99 US$" (es)
```

### Translation File Structure
```
packages/dashboard/src/i18n/
├── locales/
│   ├── en.json          # Base language (English)
│   ├── es.json          # Spanish translations
│   ├── sv.json          # Swedish translations
│   ├── de.json          # German translations
│   ├── fr.json          # French translations
│   ├── zh.json          # Chinese translations
│   ├── ar.json          # Arabic translations
│   ├── ko.json          # Korean translations
│   └── ja.json          # Japanese translations
├── index.tsx            # I18n provider and hooks
├── types.ts             # TypeScript types
└── README.md            # API documentation
```

### Translation Key Conventions
```json
{
  "common": {
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel"
  },
  "teams": {
    "invitations": {
      "acceptSuccess": "Invitation accepted successfully",
      "deleteSuccess": "Invitation deleted successfully"
    }
  },
  "plurals": {
    "items": {
      "one": "1 item",
      "other": "{count} items"
    }
  }
}
```

### Component Integration Patterns

#### Standard Usage
```typescript
import { useI18n } from '../../i18n';
import { useToast } from '@castmill/ui-common';

const MyComponent: Component = () => {
  const { t } = useI18n();
  const toast = useToast();

  const handleSuccess = () => {
    toast.success(t('teams.invitations.acceptSuccess'));
  };

  return (
    <button onClick={handleSuccess}>
      {t('common.accept')}
    </button>
  );
};
```

#### Language Selector
```typescript
import { useI18n, SUPPORTED_LOCALES } from '../../i18n';

const LanguageSelector: Component = () => {
  const { locale, setLocale } = useI18n();

  return (
    <For each={SUPPORTED_LOCALES}>
      {(localeInfo) => (
        <button 
          classList={{ active: locale() === localeInfo.code }}
          onClick={() => setLocale(localeInfo.code)}
        >
          {localeInfo.nativeName}
        </button>
      )}
    </For>
  );
};
```

### AddOn i18n Integration
AddOns receive i18n functions through the store:
```typescript
interface AddonStore {
  // ... other properties
  i18n?: {
    t: TranslateFn;
    tp: TranslatePluralFn;
    formatDate: FormatDateFn;
    formatNumber: FormatNumberFn;
    formatCurrency: FormatCurrencyFn;
    locale: () => string;
    setLocale: (locale: string) => void;
  };
}

// In AddOn component
const t = (key: string, params?: Record<string, any>) =>
  props.store.i18n?.t(key, params) || key;
```

### Translation Coverage Workflow
A GitHub Actions workflow checks for missing translations:
- Runs on every PR
- Compares all language files against English (base)
- Reports missing keys and untranslated strings
- Provides translation coverage statistics

### Best Practices

#### DO:
- Always use `t()` function for user-facing strings
- Use nested keys for logical grouping: `teams.invitations.success`
- Include context in translation keys: `buttons.save` vs `actions.save`
- Use `tp()` for countable items with proper pluralization
- Test with different locales, especially RTL (Arabic)
- Add new translation keys to all language files

#### DON'T:
- Hard-code user-facing strings in components
- Use concatenation for dynamic messages
- Forget to handle pluralization for countable items
- Mix translation systems (stick to the i18n provider)
- Skip adding translations for new features

### Common Translation Patterns

#### Toast Messages
```typescript
// Success messages
toast.success(t('teams.invitations.acceptSuccess'));
toast.success(t('teams.deleteSuccess'));

// Error messages  
toast.error(t('errors.networkError'));
toast.error(t('teams.deleteError'));
```

#### Form Labels and Placeholders
```typescript
<FormItem label={t('forms.labels.teamName')}>
  <input placeholder={t('forms.placeholders.enterTeamName')} />
</FormItem>
```

#### Confirmation Dialogs
```typescript
<ConfirmDialog
  title={t('teams.confirmDelete.title')}
  message={t('teams.confirmDelete.message', { name: teamName })}
  confirmText={t('common.delete')}
  cancelText={t('common.cancel')}
/>
```

## Toast Notification System

### Integration with i18n
The toast system from `@castmill/ui-common` works seamlessly with translations:
```typescript
import { useToast } from '@castmill/ui-common';
import { useI18n } from '../../i18n';

const toast = useToast();
const { t } = useI18n();

// Localized toast messages
toast.success(t('operation.success'));
toast.error(t('operation.error'));
```

### Migration from alert() to toast
The project has migrated from blocking `alert()` calls to user-friendly toast notifications:
```typescript
// Old pattern (blocking, poor UX)
alert('Operation completed');

// New pattern (non-blocking, good UX)
toast.success(t('operation.completed'));
```

## Development Workflow

### Adding New Features
1. Implement functionality using `t()` for all user-facing strings
2. Add translation keys to `en.json` first
3. Copy keys to all other language files with appropriate translations
4. Test with different locales
5. Run translation coverage check

### Common Gotchas
- Import `useI18n` from `'./i18n'` (relative path from components)
- Toast messages should use `t()` function, not hardcoded strings
- Watch for merge conflicts in translation files - they can cause missing translations
- RTL languages (Arabic) may need special CSS considerations

### Error Handling
When encountering missing translations, the system falls back to the translation key itself, making it easy to spot untranslated content during development.

## Backend i18n Integration

The Elixir backend uses Phoenix's built-in Gettext system:
```elixir
# In CastmillWeb.Gettext
gettext("Here is the string to translate")
ngettext("Here is the string to translate", "Here are the strings to translate", 3)
```

Translation files are stored in `priv/gettext/` following Phoenix conventions.

## AddOn System

### Architecture
Castmill uses a modular AddOn system where most functionality is provided through plugins:
- **Devices**: Device management and monitoring
- **Media**: File upload and management  
- **Playlists**: Content scheduling and organization
- **Widgets**: Custom content components

### AddOn Structure
```typescript
interface AddOn {
  name: string;
  path: string;
  icon?: string;
  endpoint?: string;
  component: string;
}
```

### Store Integration
AddOns receive a unified store with all necessary services and i18n functions:
```typescript
const storeWithI18n = {
  ...store,
  i18n: {
    t: i18n.t,
    tp: i18n.tp,
    formatDate: i18n.formatDate,
    formatNumber: i18n.formatNumber,
    formatCurrency: i18n.formatCurrency,
    locale: i18n.locale,
    setLocale: i18n.setLocale,
  },
};
```

## Performance Considerations

### Lazy Loading
Components and AddOns are lazy-loaded to improve initial bundle size:
```typescript
const Login = lazy(() => import('./components/login/login'));
const Dashboard = lazy(async () => {
  await loginUser();
  return import('./components/dashboard/dashboard');
});
```

### Translation Loading
Translation files are loaded dynamically based on user locale preference.

---

This guide should help AI agents understand and work effectively with Castmill's internationalization system and overall architecture.