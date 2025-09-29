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
- `packages/dashboard/` - Management interface (React/TypeScript)
- `packages/device/` - Device management interface
- `packages/player/` - Core media player logic
- `packages/ui-common/` - Shared UI components and utilities
- `packages/widged/` - Widget system and components

### Backend & Infrastructure
- `packages/castmill/` - Main Elixir/Phoenix backend application
- `packages/cache/` - Caching layer and resource management
- `packages/platforms/` - Platform-specific implementations (Android, WebOS, Electron, Legacy)

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
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Elixir/Phoenix, PostgreSQL, real-time channels
- **Documentation**: Docusaurus with custom plugins and social cards
- **Testing**: Vitest, React Testing Library, Phoenix test framework
- **Infrastructure**: Docker, GitHub Actions, automated deployments

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

## 🎯 Focus Areas

When providing assistance, prioritize:
1. **Code correctness** - Ensure TypeScript compliance and proper error handling
2. **Test coverage** - Write comprehensive tests (unit, integration, e2e) with >90% coverage target
3. **Architecture consistency** - Maintain existing patterns and structures  
4. **Performance** - Consider build times, bundle sizes, and runtime efficiency
5. **User experience** - Prioritize accessibility and professional UI/UX
6. **Maintainability** - Write clear, documented, testable code
7. **Documentation currency** - Keep `agents/` docs updated with any architectural changes

## � Additional Context

This is a professional digital signage platform serving enterprise customers. Code quality, reliability, and professional presentation are critical. The `agents/` documentation system ensures AI assistants can provide contextually appropriate suggestions and maintain the high standards expected in enterprise software.

**Remember**: Always leverage the `agents/` directory documentation to provide more accurate, contextual assistance tailored to Castmill's specific architecture and requirements.
