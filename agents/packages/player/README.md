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

### Playback Debug Overlay (`src/debug.ts`)

A debug overlay shows the item that each playlist is playing: its position
(`2/3`), widget name, template type, layer name, slot duration, and media
name, a progress bar with a countdown to its right, and the next item when
known. When the item reports a duration that differs from its slot, it adds
`(item …)`, for example a video whose real length is only known after its
metadata loads.

- `Playlist.playLayers` updates `renderer.debugOverlay` on every timer tick
  with the item state and the playlist's own position (`playlist.name`, the
  elapsed time in the loop, and the loop duration). Each renderer has one box
  in its upper right corner with a `Playlist` section (name, item count,
  duration, bar, and countdown to the end of the loop) and an `Item` section.
  A layout area's overlay hides the overlays of the renderers that contain it,
  and a containing overlay hides itself while a descendant overlay is visible.
  The containing playlist (for example the device's channel wrapper from
  `Layer.fromPlaylist`) would be the same in every area, so it isn't shown.
  The lower right is left free for the legacy adapter diagnostics panel.
- Layer metadata comes from `Layer.debugInfo`, which `Layer.fromJSON` and
  `Layer.fromPlaylist` fill in.
- The flag is shared through `window.__castmillDebugOverlay` because
  `@castmill/device` bundles its own copy of the player. Toggle it with
  `setDebugOverlay(enabled)` or `toggleDebugOverlay()`, or with
  `castmillDebugOverlay(true|false)` from the console. It is enabled at
  startup by the `debugOverlay=1` URL query parameter or by
  `localStorage['castmill:debugOverlay'] = 'true'`. Disabling it hides every
  overlay at once.
- Every player app also enables it at startup when built with
  `VITE_DEBUG_OVERLAY=true` (or `1`): the Android, WebOS, Electron, and legacy
  adapter player frames call
  `enableDebugOverlayFromEnv(import.meta.env.VITE_DEBUG_OVERLAY)` before
  creating the `Device`. The Phoenix browser player (`assets/js/device.js`) is
  bundled by esbuild, so `config/config.exs` inlines the value with
  `--define:import.meta.env.VITE_DEBUG_OVERLAY`; set the variable when
  starting `mix phx.server` or running `mix assets.build`/`assets.deploy`
  (config is read at startup, so restart the server after changing it). The
  flag is read in the apps, not in `@castmill/player` or `@castmill/device`,
  because those libraries are prebuilt and Vite inlines env values at build
  time.
- The overlay uses plain DOM, inline styles, `textContent`, and
  inline-block progress bars (no flexbox or grid). It reuses its elements and
  only writes values that changed, so it works on Chrome 38 (legacy WebOS).
  The box has a fixed width (21em at 12px) so it doesn't jump as the text
  changes; long lines are truncated with an ellipsis. While disabled, ticks
  only hide the overlay.

## Testing

Tests are in `packages/player/tests/`:

- `timeline.spec.ts` - Timeline unit tests including duration calculation
- `scroller.spec.ts` - Scroller widget tests
- `binding.spec.ts` - Data binding tests
- `model.spec.ts` - Model tests
- `debug-overlay.spec.ts` - Debug overlay formatting, flag, DOM, and playlist wiring
- `playlist-skip.spec.ts` - Holding, skipping, and waiting for blocked playlist items
- `template-widget-show.spec.ts` - Concurrent `TemplateWidget.show()` calls wait for the template to be ready

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

### Blocked Items

A platform video controller can mark its video as unable to play right now
through the `setBlocked` hook of the `createVideoPlaybackController` context
(WebOS does this while a video waits for a hardware decoder). Each
`TemplateWidget` hands its components a copy of the globals whose
`setPlaybackBlocked` records the block, so it reaches the nearest playlist
item as `Layer.blocked$()`. While playing an item, `Playlist.playLayers`:

- Holds the playlist clock while the item is blocked, so the item still plays
  from its beginning. `TemplateWidget.show` excludes blocked time from its
  load-time compensation for the same reason.
- Skips the item after `BLOCKED_ITEM_SKIP_MS` (1 s): it reports the block via
  `Layer.reportError` and shifts the clock to the next item's start.
- Stops skipping once every item was skipped in a row, calls
  `Renderer.blank()` to leave the area empty, and waits for the item.

`Playlist.show` also completes when the item is blocked, so a layout zone
starts playback (and can skip) even if its first item never gets ready. The
clock shift lasts for one `play()` call, so it resets when a layout loops or
the player restarts; synced playback can drift until then. Tests:
`tests/playlist-skip.spec.ts`.

### Loop Duration Refresh

`Playlist.playLayers` computes layer offsets and the total duration once, and
`Player.play()` fixes its timer period at start. Items saved with duration 0
(dynamic widgets, or videos whose length was unknown when saved) fall back to the widget's default
(10 s for video) until their media metadata is loaded. To pick up real lengths,
a non-synced looping `Player` compares `playlist.duration()` with its timer
period at each wrap. When they differ by at least 1 ms, it drops the wrap tick
and restarts from 0 on the next task (`setTimeout(0)`), which recomputes the offsets.
The restart is ignored if the player was stopped or replaced in the meantime.
Synced playback is never restarted, because its position derives from a shared
baseline.

Devices wrap each channel playlist in a layout layer (`Layer.fromPlaylist`), so
the outer slot length comes from `LayoutComponent.resolveDuration()`. Each
rendered `LayoutContainer` registers its live `Playlist` through
`attachRenderedPlaylist()`, and `resolveDuration()` uses the longest rendered
playlist. It keeps the last live value after unmount and falls back to the
never-rendered JSON copies only before anything is rendered. Without this, the
outer slot keeps the sum of fallback durations (e.g. 3 videos = 30 s) and cuts
the last video on every loop.

The JSON copies are built in `LayoutComponent.fromJSON()` from the containers
resolved against the widget config (`TemplateComponent.fromJSON(..., config)`,
passed by `TemplateWidget`). Layout widgets bind their zone playlists through
`options.layoutRef`, so the raw template options contain no playlists. Without
the config the layout reported a 10 s default before rendering, and the player
restarted it (and its videos) at the first 10 s wrap.

Stored video durations: the video transcoder saves the ffprobe duration (ms) in
`media.meta.duration`. Whenever the dashboard inserts a playlist item, or edits
one and so may change its video, `resolveWidgetDuration` in
`addons/playlists/components/playlist-view.tsx` stores that length as the
item's `duration`. It uses `resolveVideoWidgetDuration`
(`addons/playlists/utils/video-duration.ts`), which reads the media option
bound to each video component (`options.<key>.files[...]`), including videos in
groups. For media without `meta.duration`, it probes the file's metadata in the
browser. If the length is still unknown, the item keeps duration 0 and the
loop refresh above applies. The refresh remains the fallback for items without
a stored duration and for other dynamic widgets.

Show readiness: `TemplateWidget.show()` renders the template once and keeps a
`ready$` subject that emits when the template calls `onReady` (e.g. after a
video's metadata has loaded). Every `show()`, including one that arrives while
the first render is still loading, waits for it before seeking and completing.
A layout calls `onReady` right away, and the resulting seek makes each
`LayoutContainer` show and start its playlist. Without the wait, a container
could start before its first video had loaded, with that item's slot fixed at
the 10 s default. The video would then restart from 0 after 10 s on the
layout's first pass. Test: `tests/template-widget-show.spec.ts`.
Tests: `tests/player.spec.ts` ("Player loop duration refresh"),
`tests/layout-duration.spec.ts`, `addons/playlists/utils/video-duration.test.ts`
and `test/castmill/workers/video_transcoder_test.exs`.

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
