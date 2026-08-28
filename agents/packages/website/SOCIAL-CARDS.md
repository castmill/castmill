# Social Media Cards Documentation

## Overview

The Castmill documentation site now has a comprehensive dynamic social media cards system that generates professional-looking social cards for every page. This system automatically creates beautiful 1200x630 pixel social media cards optimized for sharing on platforms like Twitter, Facebook, LinkedIn, and more.

## System Components

### 1. Social Cards Plugin (`plugins/social-cards/index.js`)
- **Purpose**: Custom Docusaurus plugin that generates HTML templates for social cards during the build process
- **Features**:
  - Automatically discovers all documentation routes
  - Creates professional-looking cards with Castmill branding
  - Uses modern blue gradient design with subtle pattern overlay
  - Includes stats badges (100% Open Source, 5+ Platforms, ∞ Possibilities)
  - Generates custom titles and descriptions for each page

### 2. Image Generation Script (`scripts/generate-social-images.js`)
- **Purpose**: Converts HTML templates to high-quality JPG images using Puppeteer
- **Features**:
  - Automated screenshot generation at exact 1200x630 dimensions
  - High DPI rendering (2x device pixel ratio) for crisp images
  - Batch processing of all HTML templates
  - 90% JPEG quality for optimal file size vs quality

### 3. Package Scripts
```json
{
  "social-cards": "node scripts/generate-social-images.js",
  "build:full": "yarn build && yarn social-cards"
}
```

## Generated Cards

The system automatically generates social cards for:
- **Homepage** (`home.jpg`) - Main landing page
- **Documentation pages** - All pages under `/docs/`
- **Dynamic discovery** - Automatically finds new pages during build

### Current Generated Cards (21 total):
- `home.jpg` - Your Digital Signage Partner
- `docs-intro.jpg` - Getting Started
- `docs-player.jpg` - Player Documentation  
- `docs-widgets.jpg` - Widget Development
- `docs-api.jpg` - API Reference
- Plus 16 more automatically discovered pages

## Usage Instructions

### Automated Workflow (Recommended)
```bash
# Build site and generate all social cards
yarn build:full

# Or run separately
yarn build
yarn social-cards
```

### Manual Process
```bash
# 1. Build the site to generate HTML templates
yarn build

# 2. Generate images from templates  
yarn social-cards

# 3. Images are saved to static/img/social/
```

## Adding Social Cards to Pages

### For Markdown Documentation Pages
Add the `image` frontmatter property:

```markdown
---
sidebar_position: 1
image: /img/social/docs-intro.jpg
---

# Your Page Title
```

### For React Pages (like Home)
Use the `Head` component:

```tsx
import Head from '@docusaurus/Head';

export default function MyPage() {
  return (
    <Layout>
      <Head>
        <meta property="og:image" content="/img/social/my-page.jpg" />
        <meta name="twitter:image" content="/img/social/my-page.jpg" />
      </Head>
      {/* Page content */}
    </Layout>
  );
}
```

## Design Specifications

### Visual Design
- **Dimensions**: 1200x630 pixels (Twitter/Facebook optimal)
- **Background**: Blue gradient (#3b82f6 to #6366f1)  
- **Pattern**: Subtle dot pattern overlay
- **Typography**: System fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI')
- **Branding**: Castmill logo with clean, modern styling

### Content Structure
- **Logo**: CASTMILL (spaced uppercase lettering)
- **Title**: Large, bold page-specific title (52px)
- **Description**: Descriptive text about the page content (22px)
- **Badge**: Page type indicator (Homepage, Documentation, etc.)
- **Stats**: Three branded statistics in bottom-left corner

## Customization

### Adding New Card Templates
Edit `plugins/social-cards/index.js` and add to the `cards` array:

```javascript
{
  route: '/docs/my-new-page',
  title: 'My New Feature',
  description: 'Learn about this amazing new feature',
  type: 'Guide'
}
```

### Customizing Design
Modify the CSS styles in the `generateCardHTML` function within the plugin. Key areas:
- **Background**: Change gradient colors
- **Typography**: Adjust font sizes and weights  
- **Layout**: Modify padding, positioning
- **Branding**: Update logo, colors, stats

### Dynamic Route Detection
The plugin automatically detects routes starting with `/docs/` and creates cards with:
- Capitalized route names as titles
- Generic descriptions
- 'Documentation' type badge

## Technical Details

### Build Integration
- Runs during Docusaurus `postBuild` lifecycle
- Creates HTML templates in `build/img/social/`
- Generates README with usage instructions

### Image Generation
- Uses Puppeteer headless Chrome
- High DPI rendering (deviceScaleFactor: 2)
- JPEG compression (90% quality)
- Exact 1200x630 pixel dimensions

### File Organization
```
static/img/social/           # Generated JPG images (git tracked)
build/img/social/            # HTML templates (build artifact)
plugins/social-cards/        # Plugin source code
scripts/generate-social-images.js  # Image generation script
```

## Troubleshooting

### Common Issues

**"No HTML files found" Error**
```bash
yarn build  # Make sure to build first
yarn social-cards
```

**Puppeteer Installation Issues**
```bash
yarn add puppeteer --dev
# or use npm
npm install puppeteer --save-dev
```

**Image Quality Issues**
- Increase `deviceScaleFactor` in the script
- Adjust JPEG `quality` parameter
- Check viewport dimensions match 1200x630

### Alternative Image Generation
If Puppeteer doesn't work in your environment:

1. **Manual Screenshots**
   - Open HTML files in browser
   - Set window size to exactly 1200x630
   - Take screenshots

2. **Online Tools**
   - Upload HTML to htmlcsstoimage.com
   - Use browser developer tools device emulation

3. **Browser DevTools**
   - Open DevTools
   - Set device emulation to 1200x630
   - Take screenshots

## Performance Notes

- HTML templates are small (~5KB each)
- JPG images are optimized (~100KB each at 90% quality)
- Generation takes ~30 seconds for all 21 cards
- Cards are generated once per build, not per request

## SEO Benefits

✅ **Open Graph Support**: Proper og:image tags
✅ **Twitter Cards**: twitter:image meta tags  
✅ **LinkedIn**: Professional image previews
✅ **Facebook**: Optimized social sharing
✅ **Dynamic Content**: Unique cards per page
✅ **Professional Branding**: Consistent visual identity

The social cards system is now fully operational and will automatically generate professional social media previews for all pages in your documentation site!
