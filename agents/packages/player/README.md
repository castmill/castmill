# Player Package - Agent Documentation

## Overview

The `@castmill/player` package is the core media player logic for the Castmill Digital Signage Platform. It handles playlist playback, widget rendering, and timeline management.

## Key Components

### Timeline System (`src/widgets/template/timeline.ts`)

The Timeline class manages the temporal coordination of widget animations and content playback.

#### Timeline Items

Each timeline item has:
- `start`: When the item begins (in milliseconds)
- `duration`: How long the item plays
- `repeat`: Whether the item repeats indefinitely
- `child`: The child timeline or component to control

#### Duration Calculation

**Important**: Repeat items with explicit duration DO contribute to total duration (one loop cycle). Repeat items without explicit duration are excluded.

```typescript
duration() {
  // For repeat items, only count them if they have an explicit duration
  // (representing one loop cycle). Repeat items without duration play indefinitely.
  const itemsDuration = this.items.reduce(
    (acc, item) => {
      if (item.repeat) {
        if (item.duration) {
          return Math.max(acc, item.start + item.duration);
        }
        return acc; // Skip repeat items without explicit duration
      }
      return Math.max(acc, item.start + (item.duration || this.childDuration(item)));
    },
    0
  );
  // ...
}
```

This design allows:
- Scrollers with explicit loop duration to define the playlist duration correctly
- Background scrollers without duration to run without extending playlist duration
- Paginated content to define the actual duration
- Proper calculation of playlist total runtime

### Template Components

Template components (`layout.tsx`, `text.tsx`, `animation.tsx`, `image-carousel.tsx`) create
timeline items with `start: 0` to allow parallel playback rather than sequential stacking.

### Playlist Priming

The `primeAllLayers` function in playlist-preview.tsx ensures all auto-duration widgets
are primed before displaying the playlist. After priming:
1. Each layer's duration is calculated based on its actual content
2. The controls are updated with the correct total duration
3. Layer offsets are computed for proper sequential playback

## Testing

Tests are in `packages/player/tests/`:

- `timeline.spec.ts` - Timeline unit tests including duration calculation
- `scroller.spec.ts` - Scroller widget tests
- `binding.spec.ts` - Data binding tests
- `model.spec.ts` - Model tests

Run tests:
```bash
cd packages/player
yarn test
```

## Common Patterns

### Auto-Duration Widgets

Widgets that determine their own duration (RSS feeds, paginated lists) use:
- Default duration of 10000ms until data loads
- Duration recalculated based on content (items × page duration)
- Parent playlist updates when duration changes

### Repeat vs Non-Repeat Items

| Type | Duration Calculation | Use Case |
|------|---------------------|----------|
| Non-repeat | Always included in total | Paginated content, main display |
| Repeat with duration | Included (one loop cycle) | Scrollers, tickers with known duration |
| Repeat without duration | Excluded from total | Indefinite background elements |

