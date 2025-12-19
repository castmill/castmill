# Castmill Digital Signage Platform

You are working with the Castmill Digital Signage Platform, a comprehensive monorepo containing multiple TypeScript/JavaScript packages, an Elixir/Phoenix backend, and various platform-specific implementations.

## 🤖 Agent Documentation System

**IMPORTANT**: This project includes a specialized `agents/` directory containing AI-optimized documentation. Always consult these files when working on the codebase:

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

### Key System Documentation

| Topic | Location |
|-------|----------|
| Widget Integrations | `agents/systems/WIDGET-INTEGRATIONS.md` |
| Layout Widgets & Circular References | `agents/systems/LAYOUT-WIDGETS.md` |
| Widget Assets | `agents/systems/WIDGET-ASSETS.md` |
| Notifications | `agents/systems/notifications.md` |

## 🏗️ Project Structure

This is a Yarn workspace monorepo with the following key packages:

### Frontend Packages
- `packages/website/` - Documentation site (Docusaurus)
- `packages/dashboard/` - Management interface (SolidJS/TypeScript)
- `packages/device/` - Device management interface
- `packages/player/` - Core media player logic
- `packages/ui-common/` - Shared UI components
- `packages/widged/` - Widget system

### Backend & Infrastructure
- `packages/castmill/` - Main Elixir/Phoenix backend
- `packages/cache/` - Caching layer
- `packages/platforms/` - Platform implementations (Android, WebOS, Electron)

## 🌍 Internationalization (i18n)

**⚠️ CRITICAL**: All user-facing text must be localized.

### Quick Reference
- **9 Languages**: English, Spanish, Swedish, German, French, Chinese, Arabic (RTL), Korean, Japanese
- **100% Coverage Required**: CI validates all languages are complete

### Essential Rules

```tsx
// ❌ NEVER hardcode strings
<button>Save</button>

// ✅ ALWAYS use i18n
const { t } = useI18n();
<button>{t('common.save')}</button>
```

### Before Every Commit
```bash
cd packages/dashboard && yarn check-translations
```

### Detailed Documentation
- **Full i18n guide**: `packages/dashboard/AGENTS.md`
- **Implementation**: `packages/dashboard/src/i18n/README.md`
- **Scripts**: `packages/dashboard/scripts/README.md`

## 💡 Development Guidelines

### Code Quality Standards
- Use TypeScript for all new frontend code
- Follow existing ESLint/Prettier configurations
- Maintain >90% test coverage on new code
- Document complex logic and architectural decisions
- Update `agents/` documentation when making architectural changes

### Key Technologies
- **Frontend**: SolidJS (Dashboard), React, TypeScript, Vite
- **Backend**: Elixir/Phoenix, PostgreSQL, Oban
- **Testing**: Vitest, React Testing Library, ExUnit
- **Infrastructure**: Docker, GitHub Actions

## 🔧 Common Tasks

### Working with Packages
```bash
# Install dependencies
yarn install

# Build specific package
yarn workspace [package-name] build

# Run tests
yarn workspace [package-name] test

# Start development
yarn workspace dashboard dev
yarn workspace website start
```

### Scripts Convention
Utility scripts should be placed in `packages/[package-name]/scripts/`:
- Use `.cjs` extension for Node.js CommonJS scripts
- Document in `scripts/README.md` within the same directory
- Add yarn aliases to `package.json`

## 🔀 URL-Based Routing

The Dashboard uses URL-based routing with organization context:

```
/org/:orgId/path
```

### Key Rules
```tsx
// ✅ Always include org ID
navigate(`/org/${store.organizations.selectedId}/teams`);

// ❌ Never navigate without org context
navigate('/teams');
```

See `packages/dashboard/AGENTS.md` for detailed routing patterns.

## 🎯 Focus Areas

When providing assistance, prioritize:

1. **Code correctness** - TypeScript compliance and proper error handling
2. **Test coverage** - Comprehensive tests with >90% coverage target
3. **Internationalization** - Always localize user-facing text
4. **Architecture consistency** - Maintain existing patterns
5. **Performance** - Consider build times and runtime efficiency
6. **Documentation** - Keep `agents/` docs updated

## ⚠️ Common Pitfalls to Avoid

- Don't modify `yarn.lock` manually
- Don't ignore TypeScript errors
- Don't skip writing tests
- Don't hardcode user-facing strings
- Don't add translation keys without updating all 9 language files
- Don't forget to update `agents/` docs when changing architecture
- Don't create unnecessary files in the root directory

## 📚 Additional Resources

- **Main docs**: `agents/README.md`
- **Package guides**: `agents/packages/[package-name]/`
- **System architecture**: `agents/systems/`
- **Deployment**: `agents/infrastructure/`

**Remember**: Always leverage the `agents/` directory for detailed, contextual documentation.
