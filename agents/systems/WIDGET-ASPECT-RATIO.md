# Widget Aspect Ratio & Letterboxing System

## Overview

Widgets in Castmill can have defined aspect ratios (e.g., "16:9", "4:3", "1:1"). When a widget's aspect ratio differs from its container's aspect ratio, the system implements **letterboxing** - displaying the widget at its correct proportions with empty space (letterbox bars) filling the remaining area.

This is crucial for:
- **Playlists**: Items with different aspect ratios playing in sequence
- **Layouts**: Multiple widgets arranged in zones with various aspect ratios
- **Responsive displays**: Same content on landscape and portrait screens

## The Problem

CSS `aspect-ratio` property alone does NOT achieve proper letterboxing behavior:

```css
/* This doesn't letterbox correctly */
.widget {
  aspect-ratio: 16 / 9;
  width: 100%;
  height: 100%;
}
```

### Why CSS-Only Fails

1. **"Cover" approach** (using `max()` for width/height):
   - Widget always fills container, but zooms/crops when ratios don't match
   - Content gets cut off

2. **"Contain" approach** (using `auto`, `max-width`, `max-height`):
   - Doesn't properly scale up to fill the constraining dimension
   - Widget stays smaller than it should

3. **Static min-width/min-height**:
   - Can't know at CSS-time which dimension should be constrained
   - A 16:9 widget in a portrait container needs `min-width: 100%`
   - A 16:9 widget in a landscape container needs `min-height: 100%`

## The Solution: Dynamic ResizeObserver

The solution requires JavaScript to dynamically adjust sizing based on runtime container dimensions.

### Implementation Location

**File**: `packages/player/src/layer.ts`

### Key Components

#### 1. Aspect Ratio Parsing

```typescript
function parseAspectRatio(aspectRatio?: string): number | null {
  if (!aspectRatio) return null;
  const parts = aspectRatio.split(':');
  if (parts.length !== 2) return null;
  const width = parseFloat(parts[0]);
  const height = parseFloat(parts[1]);
  if (isNaN(width) || isNaN(height) || height === 0) return null;
  return width / height;
}
```

#### 2. Layer Class Fields

```typescript
class Layer {
  private widgetAspectRatio: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  // ...
}
```

#### 3. ResizeObserver Setup

```typescript
private setupResizeObserver() {
  this.resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) continue;

      const containerRatio = width / height;
      const widgetRatio = this.widgetAspectRatio!;

      // Find the widget element (first child of the layer)
      const widgetEl = this.el.firstElementChild as HTMLElement;
      if (!widgetEl) continue;

      if (containerRatio >= widgetRatio) {
        // Container is wider than widget ratio
        // Height is the constraint - widget fills vertically, letterboxes sides
        widgetEl.style.minHeight = '100%';
        widgetEl.style.minWidth = '';
      } else {
        // Container is taller/narrower than widget ratio
        // Width is the constraint - widget fills horizontally, letterboxes top/bottom
        widgetEl.style.minWidth = '100%';
        widgetEl.style.minHeight = '';
      }
    }
  });

  this.resizeObserver.observe(this.el);
}
```

#### 4. Widget Style Computation

```typescript
export function computeWidgetStyle(
  widget: JsonWidget,
  globals: PlayerGlobals
): JSX.CSSProperties {
  return {
    ...(widget.aspect_ratio && { 'aspect-ratio': widget.aspect_ratio.replace(':', ' / ') }),
  };
}
```

### How It Works

1. **Widget has aspect ratio** (e.g., "16:9" = 1.778)
2. **Container renders** at some dimensions (e.g., 400x600 portrait = 0.667)
3. **ResizeObserver fires** when container resizes
4. **Compare ratios**:
   - Container ratio (0.667) < Widget ratio (1.778)
   - Container is "taller" than the widget
5. **Apply constraint**:
   - Set `min-width: 100%` on widget
   - Widget fills horizontal space, maintains aspect ratio via CSS
   - Letterbox bars appear top/bottom

### Visual Examples

```
┌─────────────────────────────────┐     ┌──────────────┐
│                                 │     │  letterbox   │
│  ┌───────────────────────────┐  │     ├──────────────┤
│  │                           │  │     │              │
│  │     16:9 widget in        │  │     │   16:9 in    │
│  │     16:9 container        │  │     │   portrait   │
│  │     (no letterbox)        │  │     │   container  │
│  │                           │  │     │              │
│  └───────────────────────────┘  │     ├──────────────┤
│                                 │     │  letterbox   │
└─────────────────────────────────┘     └──────────────┘

Container wider (>=) than widget:       Container taller (<) than widget:
  → min-height: 100%                      → min-width: 100%
```

### Layer Container CSS

The layer container uses flex centering to position the widget:

```css
.layer {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;  /* Horizontal centering */
  align-items: center;      /* Vertical centering */
}
```

This ensures letterbox bars are distributed evenly (centered widget).

### Cleanup

```typescript
public unload() {
  if (this.resizeObserver) {
    this.resizeObserver.disconnect();
    this.resizeObserver = null;
  }
  // ... rest of cleanup
}
```

## Data Flow

1. **Widget Definition** (database): `aspect_ratio: "16:9"`
2. **Playlist Loading**: Aspect ratio included in widget data
3. **Layer.fromJSON()**: Extracts `widgetAspectRatio` from computed style
4. **Layer Constructor**: Parses ratio, sets up ResizeObserver
5. **Runtime**: Observer adjusts `min-width`/`min-height` on resize

## Important Considerations

### For Layouts

When implementing multi-zone layouts:

1. **Each zone is a container** with its own aspect ratio potential
2. **Zone aspect ratios are dynamic** based on layout configuration
3. **Same ResizeObserver pattern applies** - each zone watches its own dimensions
4. **Nested aspect ratios** - a layout zone might contain a widget with different ratio

### Performance

- ResizeObserver is efficient (uses browser's layout system)
- Only fires when dimensions actually change
- One observer per layer (not per pixel change)
- Cleanup on unload prevents memory leaks

### Browser Support

ResizeObserver is supported in all modern browsers:
- Chrome 64+
- Firefox 69+
- Safari 13.1+
- Edge 79+

No polyfill needed for digital signage deployment targets.

## Related Files

- `packages/player/src/layer.ts` - Layer class with ResizeObserver
- `packages/player/src/widgets/template/template.tsx` - Widget template rendering
- `packages/player/src/components/playerui.ts` - Player UI wrapper
- `packages/castmill/lib/castmill/widgets/widget.ex` - Widget schema with aspect_ratio field

## Future Enhancements

### Layout System Integration

When layouts are implemented, consider:

1. **Zone aspect ratio inheritance** - Zones might force aspect ratio on contained widgets
2. **Aspect ratio constraints** - Layout zones could define min/max aspect ratios
3. **Fill modes** - Options beyond letterbox: cover, stretch, fill
4. **Transition between ratios** - Animated aspect ratio changes between playlist items

### Potential Fill Modes

```typescript
type FillMode = 'letterbox' | 'cover' | 'stretch' | 'fill';

// letterbox: Current implementation (default)
// cover: Fill container, crop overflow
// stretch: Distort to fill (not recommended)
// fill: Ignore aspect ratio, fill container
```

### Configuration

Future widgets might expose fill mode configuration:

```json
{
  "aspect_ratio": "16:9",
  "fill_mode": "letterbox"
}
```
