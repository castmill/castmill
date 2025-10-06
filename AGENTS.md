# Castmill Digital Signage Platform

You are working with the Castmill Digital Signage Platform, a comprehensive monorepo containing multiple TypeScript/JavaScript packages, an Elixir/Phoenix backend, and various platform-specific implementations.

## 🤖 Agent Documentation System

**IMPORTANT**: This project includes a specialized `agents/` directory containing AI-optimized documentation. Always consult these files when working on the codebase to understand context, architecture, and best practices:

```
agents/
├── README.md                    # Complete project overview and navigation
├── packages/                    # Package-specific deep documentation
├── systems/                     # Cross-cutting system architecture
└── infrastructure/              # Deployment and DevOps guides
```

### When to Use Agent Documentation

1. **Before making changes** - Read relevant `agents/packages/[package-name]/` docs
2. **For architecture questions** - Check `agents/systems/` for cross-package understanding

3. **For deployment/infrastructure** - Consult `agents/infrastructure/`
4. **For comprehensive context** - Start with `agents/README.md`

## 🏗️ Project Structure

This is a Yarn workspace monorepo with the following key packages:

### Frontend Packages
- `packages/website/` - Documentation site (Docusaurus 3.9.0) with custom social cards
- `packages/dashboard/` - Management interface (SolidJS/TypeScript) with full i18n support
  - `scripts/` - Utility scripts for i18n maintenance and validation
- `packages/device/` - Device management interface
- `packages/player/` - Core media player logic
- `packages/ui-common/` - Shared UI components and utilities
- `packages/widged/` - Widget system and components

### Backend & Infrastructure
- `packages/castmill/` - Main Elixir/Phoenix backend application
- `packages/cache/` - Caching layer and resource management
- `packages/platforms/` - Platform-specific implementations (Android, WebOS, Electron, Legacy)

### Scripts Convention

**IMPORTANT**: Utility scripts for package maintenance should be placed in `packages/[package-name]/scripts/`:
- Use `.cjs` extension for Node.js CommonJS scripts
- Add `#!/usr/bin/env node` shebang for executability
- Document in `scripts/README.md` within the same directory
- Add yarn aliases to `package.json` for common usage
- Update AGENTS.md when adding scripts with new functionality

**Example**: Dashboard i18n scripts are in `packages/dashboard/scripts/`:
- `check-i18n.cjs` - Validates localization coverage
- `check-missing-translations.cjs` - Verifies translation completeness
- `merge-i18n.cjs` - Propagates new translation keys

## 🌍 Internationalization (i18n)

The Dashboard package includes a comprehensive i18n system with **mandatory** full localization.

### Location
- **Main implementation**: `packages/dashboard/src/i18n/`
- **Detailed documentation**: `packages/dashboard/src/i18n/README.md`
- **Agent best practices**: `packages/dashboard/AGENTS.md` ⭐ **READ THIS FOR ALL DASHBOARD PRs**

### Critical Rules

**⚠️ MANDATORY**: All user-facing text must be localized using the i18n system:

```tsx
// ❌ NEVER hardcode strings
<button>Save</button>

// ✅ ALWAYS use i18n
const { t } = useI18n();
<button>{t('common.save')}</button>
```

**⚠️ MANDATORY**: Add translations to ALL 9 languages when adding new features:
- English (en), Spanish (es), Swedish (sv), German (de), French (fr)
- Chinese (zh), Arabic (ar), Korean (ko), Japanese (ja)

**⚠️ MANDATORY**: Run `yarn check-translations` before every commit

### Features
- **9 Languages**: English, Spanish, Swedish, German, French, Chinese, Arabic (RTL), Korean, Japanese
- **100% Coverage**: All languages fully translated (validated by CI)
- **Text translation**: Simple `t('key')` function with parameter interpolation
- **Pluralization**: `tp('key', count)` with locale-specific rules
- **Date/time formatting**: Locale-aware dates using date-fns
- **Number formatting**: Format numbers per locale conventions
- **Currency formatting**: Display currency with proper symbols
- **RTL Support**: Full right-to-left layout support for Arabic

### Key Files
- `i18n/i18n-context.tsx` - Main provider and hooks
- `i18n/types.ts` - TypeScript types and locale mappings
- `i18n/locales/*.json` - Translation files for each language
- `components/language-selector/language-selector.tsx` - Language switcher
- `scripts/check-missing-translations.cjs` - Translation coverage validator

### Language Flags
The language selector uses country flag emojis to represent each language:
- 🇬🇧 English (en)
- 🇪🇸 Spanish (es)
- 🇸🇪 Swedish (sv)
- 🇩🇪 German (de)
- 🇫🇷 French (fr)
- 🇨🇳 Chinese (zh)
- 🇸🇦 Arabic (ar) - Saudi Arabian flag
- 🇰🇷 Korean (ko)
- 🇯🇵 Japanese (ja)

**Note**: The Arabic flag uses the Saudi Arabian flag (🇸🇦). When editing the language selector component, be careful with emoji Unicode handling to prevent corruption.

### Usage Example
```typescript
import { useI18n } from '../../i18n';

function MyComponent() {
  const { t, tp, formatDate, formatNumber, formatCurrency } = useI18n();
  
  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <p>{tp('plurals.items', count)}</p>
      <p>{formatDate(new Date())}</p>
      <p>{formatNumber(1234.56)}</p>
      <p>{formatCurrency(99.99, 'USD')}</p>
    </div>
  );
}
```

### For AI Agents Working on Dashboard

**BEFORE making ANY changes to dashboard code:**

1. **Read** `packages/dashboard/AGENTS.md` - comprehensive i18n guide
2. **Check** if your changes include user-facing text
3. **Use** i18n functions (`t()`, `tp()`, etc.) for ALL text
4. **Add** translation keys to ALL 9 language files
5. **Test** by wrapping components in `I18nProvider`
6. **Validate** with `yarn check-translations`

**CI will fail if:**
- Any user-facing text is hardcoded
- Translations are missing from any language
- Translation coverage is below 100%

See `packages/dashboard/AGENTS.md` for complete guidelines.

### How to Localize New Features

When adding new features or UI components, follow these steps to ensure proper internationalization:

#### Step 1: Use Translation Functions
**In Dashboard Core Components** (packages/dashboard/src/):
```typescript
import { useI18n } from '../../i18n';

function MyComponent() {
  const { t, tp, formatDate } = useI18n();
  
  return (
    <div>
      <h1>{t('myFeature.title')}</h1>
      <p>{t('myFeature.description', { username: user.name })}</p>
      <span>{tp('plurals.items', itemCount)}</span>
    </div>
  );
}
```

**In Addon Components** (packages/castmill/lib/castmill/addons/*/components/):
```typescript
import { AddonStore } from '../../common/interfaces/addon-store';

const MyAddonPage: Component<{ store: AddonStore }> = (props) => {
  // Create translation function from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;
  
  return (
    <div>
      <Button label={t('myAddon.addItem')} />
      <TableView columns={[
        { key: 'name', title: t('common.name') },
        { key: 'status', title: t('common.status') }
      ]} />
    </div>
  );
};
```

#### Step 2: Add Translation Keys to Locale Files

1. **Add to English first** (`packages/dashboard/src/i18n/locales/en.json`):
```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "Welcome, {{username}}!",
    "action": "Do Something",
    "success": "Operation completed successfully",
    "error": "An error occurred: {{error}}"
  }
}
```

2. **Add to all other languages** (es.json, sv.json, de.json, fr.json, zh.json, ar.json, ko.json, ja.json):
   - Copy the English structure
   - Translate the values (not the keys)
   - Keep parameter placeholders unchanged: `{{paramName}}`

#### Step 3: Key Naming Conventions

Use a hierarchical structure for translation keys:

- **Feature-based**: `featureName.element` (e.g., `playlists.addPlaylist`)
- **Common reusables**: `common.action` (e.g., `common.save`, `common.cancel`)
- **Error messages**: `featureName.errors.errorType` (e.g., `settings.errors.updateProfile`)
- **Validation**: `validation.rule` (e.g., `validation.fieldRequired`)
- **Plurals**: `plurals.itemType` with `one`/`other` (e.g., `plurals.items`)

#### Step 4: Parameter Interpolation

For dynamic values, use parameter placeholders:

```typescript
// In component
t('welcome.message', { username: 'John', count: 5 })

// In locale file
{
  "welcome": {
    "message": "Hello {{username}}, you have {{count}} notifications"
  }
}
```

#### Step 5: Pluralization

For count-dependent strings:

```typescript
// In component
tp('plurals.items', itemCount)

// In locale file
{
  "plurals": {
    "items": {
      "one": "{{count}} item",
      "other": "{{count}} items"
    }
  }
}
```

#### Step 6: Date, Number, and Currency Formatting

Use built-in formatting functions for locale-aware display:

```typescript
const { formatDate, formatNumber, formatCurrency } = useI18n();

// Dates - automatically uses locale-specific format
formatDate(new Date()) // "January 15, 2024" (en) or "15 de enero de 2024" (es)

// Numbers - uses locale-specific separators
formatNumber(1234.56) // "1,234.56" (en) or "1.234,56" (de)

// Currency - includes proper symbols and formatting
formatCurrency(99.99, 'USD') // "$99.99" (en) or "99,99 US$" (es)
```

### Translation Checklist

Before submitting code with user-facing text:

- [ ] All hardcoded strings replaced with `t()` function calls
- [ ] Translation keys added to `locales/en.json`
- [ ] Translation keys added to all 8 other locale files
- [ ] Parameter placeholders use `{{paramName}}` syntax
- [ ] Plural forms use `one`/`other` structure
- [ ] Error messages are localized
- [ ] Table columns and labels are localized
- [ ] Button labels and form fields are localized
- [ ] Modal titles and descriptions are localized
- [ ] Tested with at least 2 different languages

### Important Notes
- **Never commit hardcoded user-facing strings** - Always use translation functions
- All user-facing text must use translation functions
- Date-fns provides locale-specific date formatting
- Intl API handles number and currency formatting
- Arabic has automatic RTL layout support
- Language preference is persisted in localStorage
- Keep translation keys descriptive but concise

### Translation Coverage Validation

**CI/CD Enforcement:**
- GitHub Actions workflow runs on every PR (`.github/workflows/check-translations.yml`)
- Automatically validates all 9 languages are 100% complete
- Fails the build if any translations are missing or incomplete
- Posts detailed coverage report as PR comment
- Shows results in workflow summary

**Local Validation:**
```bash
# Check all languages
cd packages/dashboard
yarn check-translations

# Check specific language
yarn check-translations es  # Spanish
yarn check-translations de  # German
yarn check-translations zh  # Chinese
```

**Coverage Report Format:**
```
Language    Coverage    Missing    Untranslated    Status
----------------------------------------------------------
ES          100%        0          0               ✓ Complete
DE          98.5%       2          3               ⚠ Incomplete
```

- **Coverage**: % of translated keys vs English reference
- **Missing**: Keys that don't exist in the language file
- **Untranslated**: Keys with same value as English (not actually translated)
- **Status**: ✓ Complete (100%) or ⚠ Incomplete (<100%)

**Validation Script**: `packages/dashboard/scripts/check-missing-translations.cjs`
- Compares all languages against English reference
- Detects missing keys
- Identifies untranslated strings (cognates are allowed, see script)
- Provides detailed reports per language
- Returns exit code 1 if any issues found

**Before Every Commit:**
1. Run `yarn check-translations` locally
2. Fix any reported issues
3. Ensure all languages show "✓ Complete"
4. Only then commit and push

### Addon Components and i18n

**CRITICAL**: The Dashboard uses a plugin architecture where many UI components are loaded dynamically as **addons** from the Elixir server. These addon components also require full i18n support.

#### How Addon Components Work
1. **Server-side configuration**: Addons are defined in Elixir (e.g., `Castmill.Addons.Playlists`, `Castmill.Addons.Widgets`) in `packages/castmill/lib/castmill/addons/`
2. **Component location**: Addon UI components are TypeScript/SolidJS files located in `packages/castmill/lib/castmill/addons/[addon-name]/components/`
3. **Dynamic loading**: These components are bundled separately and loaded dynamically by the Dashboard at runtime via the `/dashboard/addons/` endpoint
4. **Store injection**: Addon components receive the global store (including i18n context) as props via `AddonStore` interface

#### i18n in Addon Components

Addon components receive i18n functions through the `store.i18n` property. The pattern differs slightly from Dashboard core components:

**Complete Example:**
```typescript
import { Component } from 'solid-js';
import { AddonStore } from '../../common/interfaces/addon-store';
import { Button, TableView, Column } from '@castmill/ui-common';

const PlaylistsPage: Component<{ store: AddonStore }> = (props) => {
  // Create translation function from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;
  
  // Define localized table columns
  const columns: Column[] = [
    { key: 'name', title: t('common.name'), sortable: true },
    { key: 'status', title: t('common.status'), sortable: false },
    { key: 'created', title: t('common.created'), sortable: true }
  ];
  
  return (
    <div>
      <h1>{t('playlists.title')}</h1>
      <Button 
        label={t('playlists.addPlaylist')} 
        onClick={handleAdd}
      />
      <TableView 
        columns={columns}
        data={data()}
      />
    </div>
  );
};

export default PlaylistsPage;
```

#### AddonStore Interface

The `AddonStore` interface (located in `packages/castmill/lib/castmill/addons/common/interfaces/addon-store.ts`) includes:

```typescript
interface AddonStore {
  organizations: { selectedId: string };
  socket: Socket;
  env: Env;
  i18n?: {
    t: (key: string, params?: Record<string, any>) => string;
    tp: (key: string, count: number, params?: Record<string, any>) => string;
    formatDate: (date: Date, format?: string) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    formatCurrency: (value: number, currency?: string, options?: Intl.NumberFormatOptions) => string;
    locale: () => string;
    setLocale: (locale: string) => void;
  };
}
```

#### Key Differences: Addon vs. Dashboard Core Components

| Aspect | Dashboard Core | Addon Components |
|--------|---------------|------------------|
| **i18n Access** | `useI18n()` hook | `props.store.i18n` |
| **Location** | `packages/dashboard/src/` | `packages/castmill/lib/castmill/addons/*/components/` |
| **Import** | `import { useI18n } from '../../i18n'` | Access via props |
| **Translation Keys** | Same locale files | Same locale files |
| **Pattern** | `const { t } = useI18n()` | `const t = (key, params) => props.store.i18n?.t(key, params) \|\| key` |

#### Checklist for Addon Components

When creating or modifying addon components:

- [ ] Extract `t` function from `props.store.i18n`
- [ ] Use `t()` for all user-facing strings
- [ ] Add translation keys to `packages/dashboard/src/i18n/locales/*.json`
- [ ] Localize table columns, buttons, modals, errors
- [ ] Pass `t` function to child components if needed
- [ ] Test with multiple languages

**Reference Examples**: 
- `packages/castmill/lib/castmill/addons/playlists/components/index.tsx`
- `packages/castmill/lib/castmill/addons/widgets/components/index.tsx`

**Important**: When adding new features or components (either in Dashboard core or as addons), always include i18n support from the start to prevent localization gaps. All user-facing text must be localizable.

### i18n Best Practices & Common Issues

#### File Encoding and Emoji Handling
- **CRITICAL**: When editing files with emoji flags (like `language-selector.tsx`), be extremely careful with Unicode handling
- **Issue**: Flag emojis can become corrupted (`��`) during partial file edits or when using certain text replacement methods
- **Solution**: If flag corruption occurs, rewrite the entire file cleanly rather than attempting partial fixes
- **Prevention**: Use direct emoji characters (🇸🇦) rather than Unicode escape sequences when possible

#### Translation File Structure
- **Consistency**: All 9 language files must have identical structure (same keys, same nesting)
- **Verification**: After completing translations, verify:
  ```bash
  # Check line counts (should all match)
  wc -l packages/dashboard/src/i18n/locales/*.json
  
  # Check key counts (should all be identical)
  jq -r 'paths(scalars) | join(".")' packages/dashboard/src/i18n/locales/*.json | wc -l
  
  # Find missing keys
  comm -23 <(jq -r 'paths(scalars) | join(".")' locales/en.json | sort) \
           <(jq -r 'paths(scalars) | join(".")' locales/ja.json | sort)
  ```

#### Systematic Translation Workflow
When translating to a new language:
1. **Read** the file first to assess current state
2. **Translate in sections** (10-15 keys at a time) to avoid overwhelming edits
3. **Use non-overlapping replacements** to prevent JSON corruption
4. **Build after each major section** to catch errors early
5. **Verify line count** matches other complete languages (should be 348 lines)
6. **Test in the UI** with at least 2 different languages

#### Language-Specific Considerations
- **Plural forms**: 
  - English/Spanish/French: Different forms for one/other
  - Chinese/Japanese/Korean: Same form for one/other
  - Arabic: Complex plural rules (may need specialized handling)
- **RTL languages**: Arabic requires `dir="rtl"` support in layout
- **Date formats**: Use date-fns locale-specific formatting, not hardcoded patterns
- **Number separators**: Varies by locale (1,234.56 vs 1.234,56)

#### Common Mistakes to Avoid
- ❌ Adding extra keys not present in English (e.g., `sidebar.settings` when not in base)
- ❌ Missing keys from sections (always copy full section structure)
- ❌ Hardcoding strings like "Search" instead of "Search..." (maintain exact patterns)
- ❌ Translating technical terms (Widget, Passkey, Email, JSON, ID, URL should stay English)
- ❌ File corruption from partial edits (use full section replacements)

## 💡 Development Guidelines

### Code Quality Standards
- Use TypeScript for all new frontend code
- Follow existing ESLint/Prettier configurations
- Maintain comprehensive test coverage (aim for >90% coverage on new code)
- Write unit tests, integration tests, and end-to-end tests as appropriate
- Document complex logic and architectural decisions
- Update `agents/` documentation when making architectural changes

### Architecture Patterns
- **Monorepo**: Related packages share dependencies and build tooling
- **Component-driven**: UI components in `ui-common` are shared across packages
- **Plugin architecture**: Extensible widget and platform systems
- **Modern tooling**: Vite for builds, Vitest for testing, modern React patterns

### Key Technologies
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, SolidJS (Dashboard)
- **Backend**: Elixir/Phoenix, PostgreSQL, real-time channels
- **Documentation**: Docusaurus with custom plugins and social cards
- **Testing**: Vitest, React Testing Library, Phoenix test framework
- **Infrastructure**: Docker, GitHub Actions, automated deployments
- **Internationalization**: Custom i18n system with date-fns for Dashboard

## 🔧 Common Tasks

### Working with Packages
```bash
# Install dependencies for all packages
yarn install

# Build specific package
yarn workspace [package-name] build

# Run tests for specific package  
yarn workspace [package-name] test

# Start development server
yarn workspace website start  # for documentation
yarn workspace dashboard dev  # for dashboard
```

### Best Practices for AI Assistance

1. **Start with context**: Read relevant `agents/` documentation first
2. **Understand dependencies**: Check `package.json` files for current dependencies
3. **Follow patterns**: Maintain consistency with existing code architecture
4. **Test thoroughly**: Ensure changes work across the monorepo with high test coverage
5. **Document decisions**: Add to `agents/` docs for future AI assistance
6. **Keep documentation current**: Update `agents/` files whenever code architecture changes
7. **Keep root directory clean**: Avoid creating temporary or status files in the project root
8. **Use package scripts**: Leverage existing utility scripts in `packages/*/scripts/` directories
9. **Create maintainable scripts**: If creating new scripts, place in appropriate `scripts/` directory with documentation

### Common Pitfalls to Avoid
- Don't modify `yarn.lock` manually
- Don't install packages without checking workspace compatibility
- Don't ignore TypeScript errors (they often indicate real issues)
- Don't make changes without understanding cross-package impacts
- Don't suppress warnings globally (address root causes instead)
- Don't skip writing tests (maintain high coverage standards)
- Don't forget to update `agents/` documentation when changing architecture
- Don't create unnecessary documentation files in the root directory (keep root clean)
- Don't create temporary status files, warning summaries, or troubleshooting guides that don't provide lasting value
- **Don't use partial string replacements on files with emojis** - this can corrupt Unicode characters
- **Don't add translation keys without updating all 9 language files** - maintains consistency

### Debugging i18n Issues

#### Using Dashboard Scripts

The Dashboard package includes utility scripts in `packages/dashboard/scripts/` for i18n maintenance:

**check-i18n.cjs** - Finds hardcoded strings that should use `t()`:
```bash
cd packages/dashboard && yarn check-i18n
```

**check-missing-translations.cjs** - Verifies all languages have all keys:
```bash
cd packages/dashboard && node scripts/check-missing-translations.cjs
cd packages/dashboard && node scripts/check-missing-translations.cjs ja  # Check specific language
```

**merge-i18n.cjs** - Propagates new keys from en.json to other languages:
```bash
cd packages/dashboard && node scripts/merge-i18n.cjs
```

See `packages/dashboard/scripts/README.md` for complete documentation.

#### Checking Translation Completeness
```bash
# Quick status check for all languages
for lang in en es sv de fr zh ar ko ja; do 
  printf "%-6s: %3d lines | %3d keys\n" "$lang" \
    "$(wc -l < locales/$lang.json)" \
    "$(jq -r 'paths(scalars) | join(".")' locales/$lang.json | wc -l)"
done

# Find English strings still present in translations
grep -E ': "(Add |Remove |Create |Update |Delete |Loading|Error )"' locales/ja.json

# Validate JSON structure
jq empty locales/*.json && echo "All JSON files valid"
```

#### Fixing Corrupted Emoji Files
If language selector flags show as `��`:
1. **Don't attempt partial fixes** - they often make it worse
2. **Rewrite the entire file** using a clean template
3. **Use terminal commands** (`cat > file << 'EOF'`) to avoid editor encoding issues
4. **Verify immediately** with grep to ensure emoji is correct: `grep -o "ar.*🇸🇦" file.tsx`

#### Translation Workflow Recovery
If a language file gets corrupted during translation:
1. Check git history: `git diff HEAD -- locales/lang.json`
2. If severely broken, copy from English and start fresh
3. Translate in smaller chunks (5-10 keys per replacement)
4. Build frequently to catch issues early

## 🎯 Focus Areas

When providing assistance, prioritize:
1. **Code correctness** - Ensure TypeScript compliance and proper error handling
2. **Test coverage** - Write comprehensive tests (unit, integration, e2e) with >90% coverage target
3. **Internationalization** - Always localize user-facing text using the i18n system
4. **Architecture consistency** - Maintain existing patterns and structures  
5. **Performance** - Consider build times, bundle sizes, and runtime efficiency
6. **User experience** - Prioritize accessibility and professional UI/UX
7. **Maintainability** - Write clear, documented, testable code
8. **Documentation currency** - Keep `agents/` docs updated with any architectural changes

## � Additional Context

This is a professional digital signage platform serving enterprise customers. Code quality, reliability, and professional presentation are critical. The `agents/` documentation system ensures AI assistants can provide contextually appropriate suggestions and maintain the high standards expected in enterprise software.

**Remember**: Always leverage the `agents/` directory documentation to provide more accurate, contextual assistance tailored to Castmill's specific architecture and requirements.
