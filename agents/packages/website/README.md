# Website Package Machine Documentation

This directory contains machine-specific technical documentation for the Castmill documentation website package (`packages/website/`).

## Package Overview

The website package is a Docusaurus-based documentation site that serves as the main documentation portal for Castmill at `docs.castmill.io`. It includes:

- Modern landing page with custom branding
- Comprehensive documentation structure  
- Dynamic social media cards system
- Client-side search functionality
- GitHub Pages deployment automation
- Professional theming with light/dark mode support

## Documentation Files

| File | System | Status | Description |
|------|--------|--------|-------------|
| [SOCIAL-CARDS.md](./SOCIAL-CARDS.md) | Social Cards | ✅ Complete | Dynamic social media card generation system |
| BUILD-SYSTEM.md | Build Pipeline | ⭕ Planned | Docusaurus build customization and automation |
| THEME-SYSTEM.md | Theming | ⭕ Planned | Custom theme architecture and design system |
| DEPLOYMENT.md | CI/CD | ⭕ Planned | GitHub Pages deployment and automation |
| SEARCH-SYSTEM.md | Search | ⭕ Planned | Local search implementation and optimization |

## Key Technologies

- **Docusaurus 3.9.0** - Static site generator
- **React/TypeScript** - Component development
- **Puppeteer** - Automated image generation  
- **GitHub Actions** - CI/CD pipeline
- **GitHub Pages** - Hosting platform

## Integration Points

- **Monorepo Root**: Shares yarn workspace configuration
- **UI Common**: May share components and styling (future)
- **Main Castmill App**: Links to live application
- **GitHub**: Automated deployment via Actions

## Quick Reference

### Build Commands
```bash
# Full build with social cards
yarn build:full

# Development server  
yarn start

# Social cards only
yarn social-cards
```

### Key Directories
```
packages/website/
├── docs/                    # Documentation content
├── src/                     # React components and pages
├── static/                  # Static assets
├── plugins/                 # Custom Docusaurus plugins
├── scripts/                 # Build automation scripts
└── ../../../machines/       # Machine documentation (this directory)
```

### Configuration Files
- `docusaurus.config.js` - Main Docusaurus configuration
- `package.json` - Dependencies and scripts
- `.github/workflows/` - GitHub Actions (in repo root)

---

*For comprehensive system details, refer to the individual documentation files listed above.*
