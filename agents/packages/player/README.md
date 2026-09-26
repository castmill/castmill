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

### Optional Video Playback Controller

`PlayerGlobals.createVideoPlaybackController(video, { reportError })` creates a
separate `VideoPlaybackController` for each resolved video element. Device options
forward the same factory through scheduled playlists, including nested layouts.
Without a factory, the shared component uses its normal HTML video behavior.

Controllers implement synchronous `seek(offsetMs)`, `play(offsetMs)`, `pause()`,
and `dispose()` entry points. Offsets are milliseconds. A controller owns any
asynchronous preparation, must report failures and handle rejections, and must
cancel stale seeks/playback on a newer request, pause, or disposal. Seek alone
must not start playback. The shared component still owns cache resolution, initial
readiness, duration, muting, DOM rendering, and timeline registration. The
factory context provides `refreshMedia()` for controllers that can identify a
stale local source; the optional `recoverMedia()` method allows the component
to retry an initial load once. A WebOS-specific metadata fallback prevents
readiness from waiting indefinitely for `canplaythrough`.

Platform selection and decoder workarounds belong in the integrating platform
package, not in shared URL checks or rendering-target branches. The legacy WebOS
adapter is one such integration. Rendered hook/default-behavior tests run in
`legacy-adapter-player/src/components/video-playback.test.tsx` using its existing
Solid/Vitest harness; controller tests live alongside the adapter implementation.

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

### Device maintenance capabilities

The `Machine` integration exposes optional privileged commands (`restart`,
`quit`, `reboot`, `shutdown`, `update`, and `updateFirmware`). `Device` derives
these as boolean `DeviceCapabilities` and includes them in its authenticated
device-info report. The dashboard must use the reported values rather than
inferring support from the player type or version; missing capabilities are
unsupported. Runtime-level `refresh` and `clear_cache` commands do not require
an optional machine capability.

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

## Legacy Android Compatibility

For JavaScript, CSS, layout, SVG, auto-fit text, build-order, and ADB verification
requirements for the Android 5.1/Crosswalk legacy player, see
[LEGACY-PLAYER-COMPATIBILITY.md](./LEGACY-PLAYER-COMPATIBILITY.md).
