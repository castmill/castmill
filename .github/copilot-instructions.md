# Castmill Digital Signage Platform - Copilot Instructions

You are working with the Castmill Digital Signage Platform, a comprehensive monorepo containing multiple TypeScript/JavaScript packages, an Elixir/Phoenix backend, and various platform-specific implementations serving enterprise customers.

## 🏗️ Project Architecture

This is a **Yarn workspace monorepo** with the following structure:

### Frontend Packages
- `packages/website/` - Documentation site (Docusaurus)
- `packages/dashboard/` - Management interface (SolidJS/TypeScript)
- `packages/device/` - Device management interface
- `packages/player/` - Core media player logic
- `packages/ui-common/` - Shared UI components and utilities
- `packages/widged/` - Widget system and components

### Backend (Elixir/Phoenix)
- `packages/castmill/` - Main Elixir/Phoenix backend application

### Digital Signage Players & Infrastructure
- `packages/platforms/` - Player apps for different platforms (Android, WebOS, Electron, Legacy)
- `packages/cache/` - TypeScript caching package used by players

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
- **Test Coverage**: Maintain >90% coverage on new code
- **Linting**: Follow existing ESLint/Prettier configurations
- **Architecture**: Maintain consistency with existing patterns
- **Commit Messages**: Follow conventional commits standard
- **CSS Units**: Use `em` units instead of `px` for spacing

### Key Technologies
- **Frontend**: SolidJS, TypeScript, Vite
- **Backend**: Elixir/Phoenix, PostgreSQL, Oban
- **Testing**: Vitest, React Testing Library, ExUnit
- **Build**: Vite for frontend, Mix for backend

## 🌍 Internationalization (i18n)

**CRITICAL**: All user-facing text must be localized.

- **9 Languages**: English, Spanish, Swedish, German, French, Chinese, Arabic (RTL), Korean, Japanese
- **100% Coverage Required**: CI validates all languages are complete
- **Before Commit**: Run `cd packages/dashboard && yarn check-translations`

See `packages/dashboard/AGENTS.md` for complete i18n guide.

## 🔀 URL-Based Routing

The Dashboard uses URL-based routing with organization context:

```typescript
// ✅ Always include organization ID
navigate(`/org/${store.organizations.selectedId}/teams`);

// ❌ Never navigate without org context
navigate('/teams'); // WRONG!
```

See `AGENTS.md` for complete routing patterns.

## 🔧 Common Commands

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

## ⚠️ Important Guidelines

### DO:
- Read `agents/` documentation before making changes
- Use TypeScript for all new frontend code
- Write comprehensive tests (>90% coverage target)
- Follow existing ESLint/Prettier configurations
- Update `agents/` docs when making architectural changes
- Localize all user-facing strings using the i18n system
- Add translation keys to all 9 language files

### DON'T:
- Modify `yarn.lock` manually
- Install packages without checking workspace compatibility
- Ignore TypeScript errors
- Make changes without understanding cross-package impacts
- Skip writing tests
- Create unnecessary files in the root directory
- Commit hardcoded user-facing strings

## 🎯 Focus Areas

When providing assistance, prioritize:

1. **Code correctness** - TypeScript compliance and proper error handling
2. **Test coverage** - Comprehensive tests with >90% coverage target
3. **Internationalization** - Always localize user-facing text
4. **URL-based routing** - Maintain organization context in URLs
5. **Architecture consistency** - Maintain existing patterns
6. **Performance** - Consider build times and runtime efficiency
7. **User experience** - Prioritize accessibility and professional UI/UX
8. **Maintainability** - Write clear, documented, testable code
9. **Documentation currency** - Keep `agents/` docs updated

## 📋 Quality Standards

This is a **professional digital signage platform serving enterprise customers**. Code quality, reliability, and professional presentation are critical. Always leverage the comprehensive `agents/` directory documentation to provide contextually appropriate suggestions that maintain the high standards expected in enterprise software.

## 🔗 Additional Resources

- Main documentation: `AGENTS.md` in project root
- Comprehensive AI docs: `agents/` directory
- Package-specific guidance: `agents/packages/[package-name]/`
- System architecture: `agents/systems/`
- Deployment guides: `agents/infrastructure/`
