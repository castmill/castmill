# Castmill Development Guide for AI Agents

This document provides AI agents with essential information about the Castmill platform's architecture, development patterns, and key implementations to work efficiently on the codebase.

> **📚 Important for AI Agents**: All technical documentation is organized in the [`docs/`](./docs/) directory. When working on authorization, RBAC, API integration, architecture, or testing, **always check the [`docs/`](./docs/) directory first** for comprehensive guides and implementation patterns. See the [Technical Documentation](#technical-documentation) section below.

## Table of Contents

- [Platform Overview](#platform-overview)
- [Architecture](#architecture)
- [Internationalization (i18n) System](#internationalization-i18n-system)
- [Translation Helper Scripts](#translation-helper-scripts)
- [Toast Notification System](#toast-notification-system)
- [Authorization & RBAC System](#authorization--rbac-system)
- [Technical Documentation](#technical-documentation)
- [Development Workflow](#development-workflow)
- [Performance Considerations](#performance-considerations)

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

### Translation Helper Scripts

The dashboard includes a comprehensive CLI tool for managing translations across all 9 supported languages. This tool is located at `packages/dashboard/scripts/i18n/translation-helper.cjs` and should be used instead of manually editing translation files or creating ad-hoc scripts.

#### Installation and Setup
```bash
# Navigate to dashboard directory
cd packages/dashboard

# Make the script executable (already done)
chmod +x scripts/i18n/translation-helper.cjs

# Run the tool
node scripts/i18n/translation-helper.cjs <command>
```

#### Available Commands

##### Add New Translation Keys
Add a new translation key to all language files with TODO markers:
```bash
# Add a simple key
node scripts/i18n/translation-helper.cjs add common.newButton "Click Me"

# Add a nested key
node scripts/i18n/translation-helper.cjs add teams.settings.title "Team Settings"

# Add a key with parameters
node scripts/i18n/translation-helper.cjs add users.welcome "Welcome, {name}!"
```
This creates the key in all 9 language files with the English value and `TODO: translate` markers for other languages.

##### Check Translation Completeness
Scan all language files for missing keys and untranslated content:
```bash
# Check all languages
node scripts/i18n/translation-helper.cjs check

# Check specific language
node scripts/i18n/translation-helper.cjs check --lang es
```
Reports:
- Keys present in English but missing in other languages
- Keys with "TODO: translate" markers (untranslated content)
- Translation coverage statistics

##### Sync Missing Keys
Copy structure from English to other languages, adding missing keys with TODO markers:
```bash
# Sync all languages
node scripts/i18n/translation-helper.cjs sync

# Sync specific language
node scripts/i18n/translation-helper.cjs sync --lang sv
```
Useful after merging branches or when English file has been updated.

##### List Translation Keys
Display all translation keys in a specific section:
```bash
# List all keys in a section
node scripts/i18n/translation-helper.cjs list teams

# List nested section
node scripts/i18n/translation-helper.cjs list teams.invitations
```

#### Usage Workflow

**When Adding New Features:**
1. Use `t()` function in code: `{t('newFeature.title')}`
2. Add translation key: `node scripts/i18n/translation-helper.cjs add newFeature.title "Feature Title"`
3. Translate TODO-marked strings in other language files
4. Verify: `node scripts/i18n/translation-helper.cjs check`

**When Fixing Translation Issues:**
1. Check for problems: `node scripts/i18n/translation-helper.cjs check`
2. Sync missing keys: `node scripts/i18n/translation-helper.cjs sync`
3. Translate TODO-marked strings
4. Run CI check: `node scripts/check-i18n.cjs`

**After Merging Branches:**
1. Sync all languages: `node scripts/i18n/translation-helper.cjs sync`
2. Review and translate TODO markers
3. Verify completeness: `node scripts/i18n/translation-helper.cjs check`

#### Important Notes
- **Always use this tool** instead of manually editing JSON files
- The tool maintains proper JSON formatting and nested structure
- TODO markers (`TODO: translate`) help track incomplete translations
- English (en.json) is the source of truth for key structure
- The tool automatically handles nested keys using dot notation (section.subsection.key)

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
2. Add translation keys using the helper script: `node scripts/i18n/translation-helper.cjs add <key> "English Text"`
3. Translate TODO-marked strings in other language files (or skip for initial implementation)
4. Test with different locales
5. Run translation coverage check: `node scripts/i18n/translation-helper.cjs check`

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

## Authorization & RBAC System

Castmill implements a comprehensive Role-Based Access Control (RBAC) system for managing permissions across organizations and teams.

### Role Hierarchy

Four roles with increasing levels of access:

1. **Admin** - Full access to all resources and actions
2. **Manager** - Full access to all resources and actions  
3. **Member** - CRUD on content resources, read-only on teams/widgets
4. **Guest** - Read-only access to content, no team access

### Resources & Actions

**Resources**: `playlists`, `medias`, `channels`, `devices`, `teams`, `widgets`

**Actions**: `list`, `show`, `create`, `update`, `delete`

### Permission Matrix

The permission matrix is centralized in `lib/castmill/authorization/permissions.ex`:

```elixir
# Check if user can perform action on resource
Castmill.Authorization.Permissions.can?(role, resource, action)

# Get allowed actions for role and resource
Castmill.Authorization.Permissions.allowed_actions(role, resource)

# Get accessible resources for a role
Castmill.Authorization.Permissions.accessible_resources(role)
```

### Organizations & Teams

- Users belong to **Organizations** with a specific role
- Organizations can have multiple **Teams**
- Permissions are organization-scoped
- Permission matrix is checked BEFORE database queries

### Permissions API Endpoint

Frontend can fetch user permissions for UI state management:

```
GET /dashboard/organizations/:organization_id/permissions
```

Returns:
```json
{
  "role": "member",
  "permissions": {
    "playlists": ["list", "show", "create", "update", "delete"],
    "teams": ["list", "show"]
  },
  "resources": ["playlists", "medias", "channels", "devices", "teams", "widgets"]
}
```

### Implementation Pattern

When implementing authorization-aware features:

```elixir
# In controllers
def index(conn, %{"organization_id" => org_id}) do
  user = conn.assigns.current_user
  
  case Organizations.has_access(user.id, org_id, :playlists, :list) do
    {:ok, _role} ->
      # User has permission, proceed
      playlists = Playlists.list_playlists(org_id)
      render(conn, "index.json", playlists: playlists)
    
    {:error, :forbidden} ->
      # User lacks permission
      conn
      |> put_status(:forbidden)
      |> json(%{error: "You don't have permission to access this resource"})
  end
end
```

## Technical Documentation

Comprehensive technical documentation is available in the [`docs/`](./docs/) directory. **This is the primary location for all technical documentation** - AI agents should reference these files when working on authorization, API integration, architecture, or testing.

### 📚 Documentation Categories

- **[Authorization](./docs/authorization/)** (10 files) - RBAC system, permission matrix, role implementations, test suite
- **[API](./docs/api/)** (5 files) - REST endpoint documentation, permissions integration, frontend guides
- **[Architecture](./docs/architecture/)** (2 files) - URL routing, team filtering, system design patterns
- **[Features](./docs/features/)** (1 file) - Feature-specific documentation (credential recovery, etc.)
- **[AddOns](./docs/addons/)** (1 file) - Widget development, icon management
- **[Testing](./docs/testing/)** (4 files) - Test specifications, coverage reports, quality assurance

### 🎯 Quick Reference for AI Agents

#### When working on Authorization/RBAC features:
1. **Start here**: [RBAC Overview](./docs/authorization/RBAC_OVERVIEW.md) - Quick reference for backend RBAC system ⭐
2. **Deep Dive**: [Authorization Test Suite](./docs/authorization/AUTHORIZATION_TEST_SUITE.md) - Understand the complete permission matrix
3. **Architecture**: [Authorization Architecture Diagram](./docs/authorization/AUTHORIZATION_ARCHITECTURE_DIAGRAM.md) - Visual overview
4. **Implementation**: [Generic Resource Authorization Guide](./docs/authorization/GENERIC_RESOURCE_AUTHORIZATION_GUIDE.md) - How to add authorization to new resources
5. **Role-specific**: 
   - [Manager Role Implementation](./docs/authorization/MANAGER_ROLE_IMPLEMENTATION.md)
   - [Member User Access Fix](./docs/authorization/MEMBER_USER_ACCESS_FIX.md)

#### When integrating Permissions API:
1. **API Reference**: [Permissions Endpoint Guide](./docs/api/PERMISSIONS_ENDPOINT_GUIDE.md) - Complete endpoint documentation
2. **Frontend Guide**: [Permissions Frontend Guide](./docs/api/PERMISSIONS_FRONTEND_GUIDE.md) - How to use permissions in UI components
3. **Quick Reference**: [Permissions Endpoint Summary](./docs/api/PERMISSIONS_ENDPOINT_SUMMARY.md)

#### When implementing new features:
1. **URL Routing**: [URL Routing Implementation](./docs/architecture/URL_ROUTING_IMPLEMENTATION.md) - Organization-aware routing
2. **Team Filtering**: [Team Filter URL Parameters](./docs/architecture/TEAM_FILTER_URL_PARAMS_IMPLEMENTATION.md) - URL state synchronization
3. **Feature Examples**: [Credential Recovery](./docs/features/CREDENTIAL_RECOVERY.md) - Feature implementation patterns

#### When writing tests:
1. **Test Patterns**: [Channels Component Test Spec](./docs/testing/channels.test.md) - Component testing examples
2. **Coverage Reports**: [Test Coverage PR-82](./docs/testing/TEST-COVERAGE-PR-82.md) - Multi-channel device assignment tests
3. **Integration Tests**: [Organization Invitations Tests](./docs/testing/organization-invitations-tests.md)

### 🔍 Key Documentation Files

#### Authorization & RBAC (Most Important for Permission-Related Work)
- **[Authorization Test Suite](./docs/authorization/AUTHORIZATION_TEST_SUITE.md)** - Complete test coverage for permissions system
  - 28 permission matrix unit tests
  - 13 resource access integration tests
  - 11 Organizations module integration tests
  - Test patterns and examples
  
- **[RBAC Current State and Proposal](./docs/authorization/RBAC_CURRENT_STATE_AND_PROPOSAL.md)** - System evolution and future direction
- **[Castmill 2.0 Permission System](./docs/authorization/CASTMILL_2.0_PERMISSION_SYSTEM_IMPLEMENTATION.md)** - Version 2.0 design

#### API Documentation
- **[Permissions Endpoint Guide](./docs/api/PERMISSIONS_ENDPOINT_GUIDE.md)** - Complete API reference
  - Request/response formats
  - Authentication requirements
  - Frontend integration examples
  - Caching strategies
  - Error handling

- **[Permissions Complete](./docs/api/PERMISSIONS_COMPLETE.md)** - Comprehensive permissions reference
- **[Permissions Implementation Summary](./docs/api/PERMISSIONS_IMPLEMENTATION_SUMMARY.md)** - Implementation details

#### Architecture & Design
- **[URL Routing Implementation](./docs/architecture/URL_ROUTING_IMPLEMENTATION.md)** - Organization-aware URL routing system
- **[Team Filter URL Parameters](./docs/architecture/TEAM_FILTER_URL_PARAMS_IMPLEMENTATION.md)** - URL state synchronization for team filtering

#### AddOn Development
- **[Widget Icon Upload Guide](./docs/addons/ICON-UPLOAD.md)** - Custom widget icons
  - Base64 encoding
  - External URLs
  - SVG inline support
  - Best practices

#### Testing & Quality Assurance
- **[Channels Component Test Spec](./docs/testing/channels.test.md)** - Component testing patterns
- **[Test Coverage PR-82](./docs/testing/TEST-COVERAGE-PR-82.md)** - Feature test coverage example
- **[Organization Invitations Tests](./docs/testing/organization-invitations-tests.md)** - Integration test patterns

### 📖 Complete Documentation Index

See **[docs/README.md](./docs/README.md)** for:
- Complete documentation index with all 24 files
- Detailed navigation guides
- Quick start paths for new developers
- Comprehensive topic-based organization
- Key concepts and reference materials

### 💡 Best Practices for AI Agents

1. **Always check `docs/` first** when working on authorization, permissions, or RBAC-related features
2. **Reference test suites** to understand expected behavior before making changes
3. **Follow existing patterns** documented in architecture and implementation guides
4. **Update documentation** when implementing new features or changing existing behavior
5. **Link to relevant docs** in code comments for complex authorization logic

---

This guide should help AI agents understand and work effectively with Castmill's internationalization system, authorization mechanisms, and overall architecture.