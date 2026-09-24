# Legacy Player Compatibility

## Scope

Legacy Android players run the legacy adapter in Crosswalk on Android 5.1. Treat them
as an old Chromium browser even when the device itself has a newer Android WebView.
The legacy adapter Vite build targets Chrome 38:

```ts
// packages/platforms/legacy-adapter-player/vite.config.ts
legacy({ targets: { chrome: '38' } });
```

Modern browser validation is not sufficient. Test affected changes on a connected
legacy Android player before considering them compatible.

The legacy adapter player displays English-only UI on Android, WebOS, and
Electron. Keep startup and diagnostics strings in English; do not add locale
files or language selection to `packages/platforms/legacy-adapter-player/`.
Dashboard localization remains separate.

The Android, WebOS, and Electron debug menus send the literal `console`
message to the adapter. The Android and WebOS wrappers use file origins that
can be serialized as either `null` or `file://`, including when the referrer
is omitted. On WebOS, old engines can also lose `WindowProxy` identity for a
local `file:` message; accept that bounded fallback only for WebOS file
origins. All network-hosted parents must still match `window.parent`.
Because those same engines can miss post-mount Solid updates, mount the WebOS
debug shell during the initial render and toggle its DOM display directly. Use
the shared `LegacyDebugShell` for all adapter platforms so their diagnostics
have the same Chrome 38-compatible layout, stacking behavior, and field set.

## JavaScript Rules

### Legacy WebOS wrapper

#### Observed runtime limitations

Treat the legacy WebOS engine as a distinct Chrome 38-era runtime, not as a
modern Chromium browser. The following behavior has been observed on deployed
signage hardware and must be preserved by compatibility changes:

| Limitation | Required handling |
| --- | --- |
| IndexedDB/Dexie can fail to open or report unsupported schema/key-path behavior. | Do not open IndexedDB on WebOS. Use `MemoryCache`; persist only eligible public media through the native wrapper. |
| The player needs live channel data, code, and protected resources at startup. | Start online. A service-worker app shell and native media files are not enough to start offline. |
| Native wrapper downloads cannot attach authorization headers and log their input URLs. | Send only unsigned public `/medias/` or unsigned external media to `fetchFile`; load protected, query-bearing, and code/data resources through authenticated XHR into session-only blob URLs. |
| Video decoders can omit readiness events or stall after source/seek changes. | Use `WebosVideoPlayback` and bounded metadata/seek recovery; report a final error without taking down the containing layout. |
| Local-wrapper `postMessage` events can use `null`, `file:`, or `file://` origins and lose parent `WindowProxy` identity. | Accept the exact `console` payload through the narrowly scoped WebOS file-origin exception only; keep network-parent validation strict. |
| Solid may not apply DOM created or changed after player mount. | Mount essential startup/debug DOM during initial render and set its visibility directly when the wrapper invokes it. |
| Passing an undefined WebSocket protocol can send an unwanted `Sec-WebSocket-Protocol` header. | Use the WebOS one-argument socket constructor when there is no configured subprotocol. |

The WebOS wrapper loads `/legacy` in an iframe. The adapter identifies both
`Web0S` and `WebOS` user agents, requests the existing hashed MAC identifier
through the wrapper's `getUUid` message bridge, and sends `player_ready` shortly
after mounting plus an immediate `alive` and another `alive` every 20 seconds.
Heartbeats start before cache initialization so a slow or failed cache does not
trigger the wrapper watchdog. The wrapper reloads the iframe when it does not
receive these messages. Browser-only platforms use
`crypto.getRandomValues` to generate a persistent device ID if `randomUUID`
is unavailable on an older browser or an HTTP origin.

`src/webos-legacy-api/` owns WebOS-specific bridge calls;
`src/android-legacy-api/` owns Android-specific calls. Both use the
`src/legacy-api/` iframe message transport and wrapper notifications. Each
bridge is initialized only on its corresponding platform, so a WebOS message
cannot also be handled by the Android bridge.

WebOS stores public `/medias/` files and unsigned external media through the wrapper's
native `fetchFile` API, avoiding browser storage for videos. The
source-to-local URL map is persisted without credentials; native files are
removed through `storage_removeFile` using their local path because the
wrapper's `deleteFile` hashes its input download URL. WebOS injects `MemoryCache`
instead of Dexie metadata and downloads protected code/data and same-origin
non-static or query-bearing media with `XMLHttpRequest` into session-only blob
URLs. Authorization headers and signed URLs are never sent to the wrapper's
URL-logging file API. Native media metadata is restored from the persisted
source-to-local map; channel/playlist data and code must be fetched again on
every startup.
If a previously mapped native video fails to load, the adapter invalidates its
cache entry and retries the download once, even if removing the missing native
file fails. WebOS must start online even if the app shell was cached; it does
not open IndexedDB.

`PlayerFrame` injects the adapter-local `WebosVideoPlayback` controller for every
WebOS video, including blob and remote sources. The controller owns decoder
reloads, metadata waits, bounded seek recovery, and cancellation. Immediate
timeline seek/play calls are coalesced; a paused seek preserves its offset without
starting playback. Pause, a newer request, or disposal cancels pending work.
Metadata readiness also accepts `loadeddata`, `canplay`, or an updated
`readyState` when WebOS omits `loadedmetadata`. A decoder that remains unready
after 15 seconds reports a playback error and retries after 30 seconds while
its video is still active; pause or disposal cancels the retry. Other videos
and the layout continue independently.
The video widget waits for `canplay` or `canplaythrough`, but a bounded
metadata fallback allows WebOS videos without either event to start. Final
failures use the existing player error reporter.

The shared player exposes only the optional per-element
`createVideoPlaybackController` factory, passed through Device globals and nested
playlists. It does not detect cache URLs or apply compatibility policy to the
`poster` target. Android, Electron, browser players, and dashboard previews use
the unchanged default video behavior when no factory is supplied.

Phoenix constructs its socket transport with a second, undefined argument
when no subprotocol is configured. The WebOS transport uses a one-argument
native `WebSocket` constructor instead, since older WebOS browsers can send
an unintended `Sec-WebSocket-Protocol` request header otherwise.

### Use transpiled syntax, but do not assume browser APIs

The legacy adapter's Vite legacy plugin transpiles supported JavaScript syntax and
bundles configured ECMAScript polyfills. TypeScript compilation does **not** polyfill
Web Platform APIs.

| Category                                     | Guidance                                                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language syntax and standard-library methods | Use the adapter's production build; do not rely on untranspiled syntax or methods outside its configured polyfills.                                                    |
| `ResizeObserver`                             | Not available in Crosswalk. Feature-detect it, then use a small fallback such as `window.resize` plus an initial `requestAnimationFrame` measurement.                  |
| Fetch, promises, maps, sets                  | Use the adapter's existing polyfill setup. Do not add per-component implementations.                                                                                   |
| DOM layout measurements                      | Measure after layout has settled. A first `onMount` measurement can occur before a flex layout receives its final dimensions.                                          |
| Browser-only APIs                            | Feature-detect APIs such as storage, media, observers, and permissions. Provide an explicit fallback or surface a supported error; never silently assume availability. |

Avoid adding a large polyfill merely for a narrow use case. For example, a
`ResizeObserver` polyfill may poll or use fragile mutation heuristics. Native
`ResizeObserver` plus a `window.resize` fallback is more reliable and keeps the
legacy bundle smaller.

## CSS and Layout Rules

### Do not use unsupported layout primitives

Avoid these for player rendering that must work on the legacy Android target:

| Feature                                            | Why                                                                                                        | Compatible approach                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| CSS Grid (`display: grid`, `grid-template-*`)      | Not supported by the Crosswalk target. QR modules rendered as an empty-looking box.                        | SVG, flexbox, or explicit positioned elements.                                                             |
| `aspect-ratio`                                     | Not supported by the target.                                                                               | Give the parent deterministic dimensions, or use an SVG `viewBox` with `preserveAspectRatio`.              |
| Percentage-sized flex children without constraints | Crosswalk can resolve percentage heights differently from current Chrome and shrink siblings unexpectedly. | Set intended `flex-shrink`, `box-sizing`, and explicit child sizing. Test both empty and populated states. |

Flexbox is available, but use it conservatively:

- Set `flex-shrink: 0` for fixed-size cards or media that must not collapse.
- Give text a dedicated height band if it must auto-fit within a column.
- Check empty, short, and long content values because flex sizing changes when a
  sibling is hidden.
- Prefer `em` units for spacing, consistent with the repository standard.

### QR codes

Render QR codes as SVG rather than a CSS Grid:

```tsx
<svg
  viewBox={`0 0 ${gridSize} ${gridSize}`}
  preserveAspectRatio="xMidYMid meet"
  shape-rendering="crispEdges"
>
  <rect width={gridSize} height={gridSize} fill={backgroundColor} />
  {/* One rect per dark module */}
</svg>
```

`shape-rendering="crispEdges"` is required to prevent Chrome from antialiasing
adjacent module edges into thin visible seams.

Use template conditional styles (`$styles`) for state-dependent layouts, such as
hiding an empty QR caption and expanding the QR card. Ensure every component that
uses `$styles` preserves `json.$styles` in its `fromJSON` implementation; otherwise
the template data reaches the player but its conditional style is silently dropped.

## Text Auto-Fitting

Auto-fit text must compare the rendered text bounds with the available parent bounds:

1. Measure the text element with `getBoundingClientRect()`.
2. Measure its containing layout box, not an ancestor that is larger than the text's
   actual allocation.
3. Reduce font size until both text width and height fit.
4. Re-run once in `requestAnimationFrame` after mount.
5. On browsers without `ResizeObserver`, re-run on `window.resize`.

Do not use the fixed text container's own width as a proxy for text width; it remains
the same while its content overflows, causing clipping instead of font reduction.

## Build and Verify

`@castmill/device` bundles `@castmill/player`. After changing player source, rebuild
in this order before testing the legacy adapter:

```bash
yarn workspace @castmill/player build
yarn workspace @castmill/device build
yarn workspace @castmill/legacy-adapter-player build:server
```

The final command writes the adapter served by Phoenix to
`packages/castmill/priv/static/legacy/`. Rebuilding only `@castmill/player` leaves
the stale player implementation embedded in `@castmill/device/dist`.

The legacy adapter build also generates `/legacy/sw.js` from the final Vite
output. The worker precaches one complete, content-addressed adapter release and
activates it only after every required file is available. It controls both
`/legacy` and `/legacy/` without reloading the currently running page. Do not
maintain its hashed asset list manually.

Offline cold startup requires:

- an HTTPS adapter origin trusted by the legacy runtime;
- one successful online load to install the shell and populate content caches;
- the adapter shell and APIs to retain their origin; and
- proxies to preserve `Service-Worker-Allowed: /legacy` on `/legacy/sw.js`.

The shell worker does not replace the content caches. IndexedDB stores the
channel/playlist metadata, `StorageBrowser` stores browser resources, and legacy
Android uses `AndroidLegacyFileStorage` plus its persisted `FILE_MAP` for native
media. Validate all layers during an offline restart.

### Legacy Android content-cache recovery

The legacy Android cache treats IndexedDB and native files as independently
recoverable indexes:

- A malformed or structurally invalid `FILE_MAP` is reset to an empty map. The
  IndexedDB reconciliation then removes stale metadata so content can be
  downloaded again.
- Current Android wrappers expose `fileExists` through the iframe bridge.
  `AndroidLegacyFileStorage.listFiles()` removes mappings for native files that
  have disappeared. Older wrappers remain compatible but cannot perform this
  proactive check.
- If IndexedDB reports a database failure during initialization, the cache
  deletes and recreates that database. Native files without rebuilt metadata are
  treated as unreferenced and removed.
- Native `CacheFull` errors are translated to `NOT_ENOUGH_SPACE`, causing the
  cache to evict least-recently-used entries and retry. If no cached content can
  make enough room, media lookup returns no local URL instead of terminating the
  player loop.
- A full cache clear deletes every IndexedDB entry and the complete native
  storage path, including files orphaned by metadata corruption. It must reload
  the player afterward so it cannot retain deleted media or code URLs in memory.
- Reconciliation cleanup is best effort. A missing or concurrently deleted
  native file is logged but does not block player startup.

Deploy the matching `android-app` wrapper when relying on native existence
checks. Its storage bridge reserves 128 MB before each chunk, makes deletion
idempotent, and removes partial downloads after terminal failures.

With an Android player attached over ADB:

```bash
adb devices -l
adb shell am force-stop com.optimalbits
adb shell monkey -p com.optimalbits 1
adb logcat -d -v brief | grep -Ei 'JavaScript ERROR|Crosswalk'
adb shell screencap -p /sdcard/player.png
adb pull /sdcard/player.png /tmp/player.png
```

For DOM inspection, Crosswalk exposes Chrome DevTools through an abstract socket:

```bash
adb forward tcp:9222 localabstract:com.optimalbits_devtools_remote
curl http://127.0.0.1:9222/json
```

Validate visual changes using screenshots at the device's native display size. Check
both a populated QR caption and an empty caption, long auto-fit text, configured
foreground/background colors, and square QR scaling.
