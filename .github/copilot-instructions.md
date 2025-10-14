# Castmill Digital Signage Platform - Copilot Instructions

You are working with the Castmill Digital Signage Platform, a comprehensive mon## 🎯 Focus Areas

When providing assistance, prioritize:

1. **Code correctness** - Ensure TypeScript compliance and proper error handling
2. **Test coverage** - Write comprehensive tests with >90% coverage target
3. **Internationalization** - Always localize user-facing text using the i18n system
4. **URL-based routing** - Maintain organization context in URLs for proper state management
5. **Architecture consistency** - Maintain existing patterns and structures
6. **Performance** - Consider build times, bundle sizes, and runtime efficiency
7. **User experience** - Prioritize accessibility and professional UI/UX
8. **Maintainability** - Write clear, documented, testable code
9. **Documentation currency** - Keep `agents/` docs updated with architectural changes

## 🔀 URL-Based Routing & Organization Switching

**CRITICAL**: The Dashboard uses URL-based routing with organization context embedded in URLs.

### Key Patterns

**URL Structure**: `/org/:orgId/path`
- Example: `/org/abc-123/teams`, `/org/abc-123/content/playlists`

**Navigation Requirements**:
```typescript
// ✅ Always include organization ID
navigate(`/org/${store.organizations.selectedId}/teams`);

// ❌ Never navigate without org context
navigate('/teams'); // WRONG!
```

**Addon Component Remounting**:
- SolidJS Router doesn't remount on param changes
- Use `Show` with `keyed` to force remount when org changes:
  ```tsx
  <Show when={params.orgId} keyed>
    {(orgId) => <AddonComponent key={orgId} />}
  </Show>
  ```

**Store Updates**:
- Use `setStore()` for all store mutations
- Never mutate store directly: `store.x = y` ❌

See `AGENTS.md` "URL-Based Routing & Organization Switching" section for complete details.

## 📋 Quality Standardsng multiple TypeScript/JavaScript packages, an Elixir/Phoenix backend, and various platform-specific implementations serving enterprise customers.

## 🏗️ Project Architecture

This is a **Yarn workspace monorepo** with the following structure:

### Frontend Packages (TypeScript/React)
- `packages/website/` - Documentation site (Docusaurus 3.9.0) with custom social cards
- `packages/dashboard/` - Management interface (React/TypeScript)
- `packages/device/` - Device management interface
- `packages/player/` - Core media player logic
- `packages/ui-common/` - Shared UI components and utilities
- `packages/widged/` - Widget system and components

### Backend (Elixir/Phoenix)
- `packages/castmill/` - Main Elixir/Phoenix backend application

### Digital Signage Players & Infrastructure
- `packages/platforms/` - Castmill digital signage player apps for different platforms (Android, WebOS, Electron, Legacy)
- `packages/cache/` - TypeScript caching package used by players (frontend/player hybrid)

## 📖 AI Documentation System

**IMPORTANT**: This project includes a specialized `agents/` directory containing AI-optimized documentation. **Always consult these files first** when working on the codebase:

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

## 💻 Development Standards

### Code Quality Requirements
- **TypeScript**: Use for ALL new frontend code
- **Test Coverage**: Maintain >90% coverage on new code (unit, integration, e2e tests)
- **Linting**: Follow existing ESLint/Prettier configurations
- **Architecture**: Maintain consistency with existing patterns
- **Commit Messages**: Follow conventional commits standard (e.g., `feat:`, `fix:`, `docs:`, `refactor:`)
- **CSS Units**: Use `em` units instead of `px` for spacing, margins, and padding (improves scalability and accessibility)

### Key Technologies
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Elixir/Phoenix, PostgreSQL, real-time channels  
- **Players**: TypeScript-based digital signage apps for multiple platforms
- **Documentation**: Docusaurus with custom plugins
- **Testing**: Vitest, React Testing Library, Phoenix test framework
- **Build**: Vite for frontend/players, Mix for backend

### Architecture Patterns
- **Monorepo**: Related packages share dependencies and build tooling
- **Component-driven**: UI components in `ui-common` are shared across packages
- **Digital signage platform**: Player apps deployed across multiple platforms (Android, WebOS, etc.)
- **Modern tooling**: Vite for builds, Vitest for testing

## 🔧 Common Commands

```bash
# Install dependencies for all packages
yarn install

# Build specific package
yarn workspace [package-name] build

# Run tests for specific package
yarn workspace [package-name] test

# Format code
yarn run format:all
yarn run format:check:all

# Start development servers
yarn workspace website start    # Documentation site
yarn workspace dashboard dev    # Dashboard
```

## ⚠️ Important Guidelines

### DO:
- Read `agents/` documentation before making changes
- Use TypeScript for all new frontend code
- Write comprehensive tests (>90% coverage target)
- Follow existing ESLint/Prettier configurations
- Use conventional commits format for all commit messages
- Update `agents/` docs when making architectural changes
- Maintain professional UI/UX standards for enterprise users
- **Localize all user-facing strings** using the i18n system (see AGENTS.md for detailed guide)
- Add translation keys to all 9 language files when adding new features

### DON'T:
- Modify `yarn.lock` manually
- Install packages without checking workspace compatibility
- Ignore TypeScript errors
- Make changes without understanding cross-package impacts
- Skip writing tests
- Create unnecessary files in the root directory
- **Commit hardcoded user-facing strings** - always use translation functions

## � Internationalization (i18n)

**CRITICAL**: The Dashboard package has a comprehensive i18n system supporting 9 languages. All user-facing text must be localized.

### Quick Reference
- **Location**: `packages/dashboard/src/i18n/`
- **Supported Languages**: English, Spanish, Swedish, German, French, Chinese, Arabic (RTL), Korean, Japanese
- **Documentation**: See `AGENTS.md` for complete i18n guide with examples

### For Dashboard Core Components
```typescript
import { useI18n } from '../../i18n';

const { t, tp, formatDate } = useI18n();
// Use: t('common.save'), tp('plurals.items', count), formatDate(new Date())
```

### For Addon Components
```typescript
const t = (key: string, params?: Record<string, any>) =>
  props.store.i18n?.t(key, params) || key;
// Use: t('playlists.addPlaylist'), t('common.name')
```

### When Adding New Features
1. Use `t('key')` for all user-facing strings
2. Add keys to `packages/dashboard/src/i18n/locales/en.json` first
3. Add translations to all 8 other language files
4. Never commit hardcoded strings like "Add Item" or "Delete"
5. See `AGENTS.md` for detailed step-by-step guide

## �🎯 Focus Areas

When providing assistance, prioritize:

1. **Code correctness** - Ensure TypeScript compliance and proper error handling
2. **Test coverage** - Write comprehensive tests with >90% coverage target
3. **Internationalization** - Always localize user-facing text using the i18n system
4. **Architecture consistency** - Maintain existing patterns and structures
5. **Performance** - Consider build times, bundle sizes, and runtime efficiency
6. **User experience** - Prioritize accessibility and professional UI/UX
7. **Maintainability** - Write clear, documented, testable code
8. **Documentation currency** - Keep `agents/` docs updated with architectural changes

## 📋 Quality Standards

This is a **professional digital signage platform serving enterprise customers**. Code quality, reliability, and professional presentation are critical. Always leverage the comprehensive `agents/` directory documentation to provide contextually appropriate suggestions that maintain the high standards expected in enterprise software.

## 🔗 Additional Resources

- Main documentation: `AGENTS.md` in project root
- Comprehensive AI docs: `agents/` directory
- Package-specific guidance: `agents/packages/[package-name]/`
- System architecture: `agents/systems/`
- Deployment guides: `agents/infrastructure/`