# Website Package - Documentation Site

This is the Castmill documentation website built with **Docusaurus 3.9.0** and deployed to `docs.castmill.io`.

## 📋 Package Overview

- **Technology**: Docusaurus 3.9.0 with React 18
- **Purpose**: Professional documentation site with custom social media cards
- **Deployment**: GitHub Pages at docs.castmill.io
- **Build System**: Custom social card generation + standard Docusaurus build

## 🎯 Key Features

### Dynamic Social Media Cards

- **Custom plugin**: `plugins/social-cards/index.js` generates HTML templates at build time
- **Automation**: `scripts/generate-social-images.js` converts HTML to 1200x630 JPG images
- **Coverage**: 21+ social cards for all major documentation pages
- **Reference**: See `agents/packages/website/SOCIAL-CARDS.md` for complete technical details

### Professional Theming

- **Dual mode**: Light/dark theme with custom CSS overrides
- **Custom icons**: Inline SVG components for Castmill features
- **Enterprise styling**: Professional appearance suitable for business use

## 🔧 Development Commands

```bash
# Development server (with hot reload)
yarn start

# Production build (includes social card generation)
yarn build

# Serve built site locally
yarn serve

# Search functionality
# Uses @easyops-cn/docusaurus-search-local for client-side search
```

## 📁 Key Files & Directories

```
packages/website/
├── docusaurus.config.js         # Main configuration with custom plugins
├── plugins/social-cards/        # Custom social card generation plugin
├── scripts/generate-social-images.js  # Puppeteer image generation
├── src/
│   ├── components/              # React components
│   ├── pages/                   # Custom pages (landing page, etc.)
│   └── css/                     # Custom styles and theme overrides
├── docs/                        # Documentation content (Markdown)
├── static/                      # Static assets
│   └── img/social/              # Generated social media images
└── build/                       # Generated build output
    └── img/social/              # Social card HTML templates
```

## ⚠️ Important Notes

### Build Process

1. **Always run full build** before deployment to regenerate social cards
2. **Social card generation** happens during `docusaurus build` via custom plugin
3. **Images are generated separately** using the Node.js script with Puppeteer

### Dependencies

- **React/React-DOM**: Added explicitly to resolve peer dependency warnings
- **@mdx-js/react**: Required for MDX content processing
- **@types/react**: TypeScript support for React components

### Common Issues

- **SSR compatibility**: Components must work with server-side rendering
- **Theme consistency**: Always test both light and dark modes
- **Social card previews**: Check `build/img/social/` for HTML templates before image generation

## 🎨 Styling Guidelines

When working on the website:

- **Follow existing CSS patterns** in `src/css/custom.css`
- **Test both themes** - light and dark mode compatibility
- **Use CSS custom properties** for theme-aware styling
- **Maintain professional appearance** suitable for enterprise customers

## 🧪 Testing

- **Build testing**: Always test `yarn build` after changes
- **Preview testing**: Use `yarn serve` to test production build locally
- **Social card testing**: Verify generated images in browser dev tools

Remember: This is a professional documentation site representing Castmill to enterprise customers. Maintain high quality standards and test thoroughly before deployment.
