# Castmill Digital Signage Platform - Copilot Instructions

You are working with the Castmill Digital Signage Platform, a comprehensive monorepo containing multiple TypeScript/JavaScript packages, an Elixir/Phoenix backend, and various platform-specific implementations serving enterprise customers.

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

### DON'T:
- Modify `yarn.lock` manually
- Install packages without checking workspace compatibility
- Ignore TypeScript errors
- Make changes without understanding cross-package impacts
- Skip writing tests
- Create unnecessary files in the root directory

## 🎯 Focus Areas

When providing assistance, prioritize:

1. **Code correctness** - Ensure TypeScript compliance and proper error handling
2. **Test coverage** - Write comprehensive tests with >90% coverage target
3. **Architecture consistency** - Maintain existing patterns and structures
4. **Performance** - Consider build times, bundle sizes, and runtime efficiency
5. **User experience** - Prioritize accessibility and professional UI/UX
6. **Maintainability** - Write clear, documented, testable code
7. **Documentation currency** - Keep `agents/` docs updated with architectural changes

## 📋 Quality Standards

This is a **professional digital signage platform serving enterprise customers**. Code quality, reliability, and professional presentation are critical. Always leverage the comprehensive `agents/` directory documentation to provide contextually appropriate suggestions that maintain the high standards expected in enterprise software.

## 🔗 Additional Resources

- Main documentation: `AGENTS.md` in project root
- Comprehensive AI docs: `agents/` directory
- Package-specific guidance: `agents/packages/[package-name]/`
- System architecture: `agents/systems/`
- Deployment guides: `agents/infrastructure/`