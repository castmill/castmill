# Widget Icons Guide

This guide explains how to create, add, and manage icons for widgets in the Castmill Digital Signage Platform.

## Overview

Each widget can have two icon variants:
- **`icon`** - Main icon (64x64px) used in the widget chooser and larger displays
- **`small_icon`** - Compact icon (32x32px) used in playlist items and tight spaces

Icons are displayed in:
1. **Widget Chooser** - When adding widgets to a playlist
2. **Playlist Items** - As thumbnails for widgets without media (Image/Video widgets show actual media thumbnails instead)

## Icon Storage Location

Widget icons are stored as static files in:
```
packages/castmill/priv/static/widgets/{widget-slug}/
├── icon.svg          # Main icon (64x64)
└── icon-small.svg    # Small icon (32x32)
```

The icons are served at URLs like:
- `/widgets/{widget-slug}/icon.svg`
- `/widgets/{widget-slug}/icon-small.svg`

**Important**: The `widgets` directory must be included in `static_paths` in `castmill_web.ex` for icons to be served.

## Current Widget Icons

| Widget | Slug | Main Icon | Small Icon | Theme |
|--------|------|-----------|------------|-------|
| Image | `image` | ✅ | ✅ | Dark |
| Video | `video` | ✅ | ✅ | Dark |
| Weather | `weather` | ✅ | ✅ | Dark |
| Web | `web` | ✅ | ✅ | Dark |
| Intro | `intro` | ✅ | ✅ | Dark |
| QR Code | `qr-code` | ✅ | ✅ | Light (traditional) |
| Spotify Now Playing | `spotify-now-playing` | ✅ | ✅ | Brand (green) |
| Stock Ticker | `stock-ticker` | ✅ | ✅ | Dark |
| Layout Widget | `layout-widget` | ✅ | ✅ | Dark |

## Icon Design Guidelines

### Technical Requirements

| Property | Main Icon | Small Icon |
|----------|-----------|------------|
| Format | SVG (required) | SVG (required) |
| ViewBox | `0 0 64 64` | `0 0 32 32` |
| Size | 64x64 pixels | 32x32 pixels |
| Background | Rounded rect with border | Rounded rect with border |
| Border radius | 8px | 4px |

### Dark Theme Design (Standard)

Most widget icons use a dark theme for consistency with the dashboard UI:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <!-- Background -->
  <rect x="2" y="2" width="60" height="60" rx="8" fill="#1a1a2e" stroke="#2d2d4a" stroke-width="2"/>
  
  <!-- Icon content with bright/colorful elements -->
</svg>
```

### Color Palette

```css
/* Dark theme background */
--icon-bg: #1a1a2e;           /* Dark blue-black background */
--icon-border: #2d2d4a;       /* Subtle border */
--icon-surface: #4a4a6a;      /* Secondary surface color */

/* Accent colors (for icon content) */
--yellow: #fbbf24;            /* Sun, stars, highlights */
--blue: #3b82f6;              /* Web, data elements */
--light-blue: #60a5fa;        /* Highlights, gradients */
--green: #10b981;             /* Success, nature */
--red: #ef4444;               /* Play buttons, alerts */
--indigo: #6366f1;            /* Layout zones, UI elements */
--purple: #818cf8;            /* Layout highlights */

/* Cloud/neutral colors */
--cloud-gray: #64748b;        /* Gray clouds, neutral elements */
--cloud-light: #e2e8f0;       /* White/light clouds */
--cloud-lighter: #f1f5f9;     /* Highlights on clouds */
```

### Design Best Practices

1. **Dark Background**: Use `#1a1a2e` background with `#2d2d4a` border
2. **Colorful Content**: Use bright, saturated colors for icon elements
3. **Shadows**: Use SVG `<filter>` with `feDropShadow` for depth
4. **Simplicity**: Icons should be recognizable at small sizes
5. **Consistency**: Follow the established visual language

## Adding Icons to a New Widget

### Step 1: Create the Icon Files

**Main Icon (64x64):**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <!-- Optional shadow filter for depth -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Dark background -->
  <rect x="2" y="2" width="60" height="60" rx="8" fill="#1a1a2e" stroke="#2d2d4a" stroke-width="2"/>
  
  <!-- Icon content with colorful elements -->
</svg>
```

**Small Icon (32x32):**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <!-- Dark background -->
  <rect x="1" y="1" width="30" height="30" rx="4" fill="#1a1a2e" stroke="#2d2d4a" stroke-width="1"/>
  
  <!-- Simplified icon content -->
</svg>
```

### Step 2: Place Files in Static Directory

```bash
mkdir -p packages/castmill/priv/static/widgets/{widget-slug}
cp icon.svg packages/castmill/priv/static/widgets/{widget-slug}/
cp icon-small.svg packages/castmill/priv/static/widgets/{widget-slug}/
```

### Step 3: Update Widget Database Record

For new widgets, include icon paths in the widget definition (e.g., in `widget.json`):

```json
{
  "name": "My Widget",
  "slug": "my-widget",
  "icon": "/widgets/my-widget/icon.svg",
  "small_icon": "/widgets/my-widget/icon-small.svg"
}
```

For existing widgets, create a migration:

```elixir
defmodule Castmill.Repo.Migrations.AddMyWidgetIcons do
  use Ecto.Migration

  def up do
    execute("""
      UPDATE widgets
      SET icon = '/widgets/my-widget/icon.svg',
          small_icon = '/widgets/my-widget/icon-small.svg',
          updated_at = NOW()
      WHERE slug = 'my-widget'
    """)
  end

  def down do
    execute("""
      UPDATE widgets
      SET icon = NULL, small_icon = NULL, updated_at = NOW()
      WHERE slug = 'my-widget'
    """)
  end
end
```

## Icon URL Resolution

Widget icons use relative paths (starting with `/`) that are resolved using the `baseUrl` from the addon configuration:

```typescript
// In playlist-item.tsx and widget-chooser.tsx
const getIconUrl = (icon: string | undefined, baseUrl: string): string | undefined => {
  if (!icon) return undefined;
  if (icon.startsWith('/')) {
    return `${baseUrl}${icon}`;
  }
  return icon;
};
```

This ensures icons work correctly regardless of the deployment URL.

## Widget-Specific Icon Designs

### Weather Widget
- Sun with rays (upper right)
- Layered clouds: gray (back) + white (front)
- Drop shadows for depth

### Image Widget  
- Picture frame with mountains and sun
- Green nature tones

### Video Widget
- Film frame with sprocket holes
- Red play button

### Web Widget
- Globe with meridian lines
- Blue color scheme

### Layout Widget
- 3-zone grid representation
- Indigo/purple zones

### Intro Widget
- Star burst with rays
- Yellow/gold tones

### QR Code Widget (Exception)
- **White background** (traditional QR appearance)
- Black QR pattern for recognizability

## Testing Icons

After adding icons:

1. Restart the Phoenix server to pick up new static files
2. Check the widget chooser in the Playlists addon
3. Verify icons display correctly in playlist items
4. Test on both light and dark backgrounds
5. Verify small icons are legible at actual display size

## Icon Resources

### Recommended Tools

- **Figma** - Professional vector design
- **Inkscape** - Free, open-source SVG editor
- **SVGOMG** - SVG optimization (https://jakearchibald.github.io/svgomg/)

### Icon Libraries (for inspiration)

- **Lucide Icons** - https://lucide.dev/
- **Heroicons** - https://heroicons.com/
- **Phosphor Icons** - https://phosphoricons.com/

When using icons from libraries:
1. Check the license allows commercial use
2. Customize colors to match dark theme palette
3. Maintain consistent sizing with other widget icons

## Checklist for New Widget Icons

- [ ] Created 64x64 main icon (`icon.svg`)
- [ ] Created 32x32 small icon (`icon-small.svg`)
- [ ] Used SVG format with proper viewBox
- [ ] Used dark theme background (`#1a1a2e`)
- [ ] Placed files in `priv/static/widgets/{slug}/`
- [ ] Updated widget database record with icon paths
- [ ] Verified icons display in widget chooser
- [ ] Verified icons display in playlist items

## Related Files

- **Icon files**: `packages/castmill/priv/static/widgets/*/`
- **Migration**: `packages/castmill/priv/repo/migrations/20251231100000_add_widget_icons.exs`
- **Static paths config**: `packages/castmill/lib/castmill_web.ex`
- **Widget chooser**: `packages/castmill/lib/castmill/addons/playlists/components/widget-chooser.tsx`
- **Playlist item**: `packages/castmill/lib/castmill/addons/playlists/components/playlist-item.tsx`
- **Widgets addon**: `packages/castmill/lib/castmill/addons/widgets/components/index.tsx`
