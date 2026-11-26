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

The shared template boundary resets `text-align: initial` so host UI centering
cannot leak into widgets. This CSS-wide keyword works on Chrome 38 and preserves
direction-aware defaults (left for LTR, right for RTL). Do not reset every text
node: authored alignment on widget groups must continue to inherit to children.
Verify default, centered and right-aligned groups inside a center-aligned host.

Layout readiness waits for the initial content in every populated zone (empty
zones are immediately ready). Keep this signal after nested media initialization:
the dashboard uses renderer readiness to measure durations without polling a
magic fallback value. This does not pre-load every later item in zone playlists.
Decoder-blocked zones must still finish seeks so their playlists can run the
blocked-item skip mechanism. Reserve newly loaded WebOS decoders across initial
seeks until playback starts; another preload must not steal them during handoff.

Carousels gate initial readiness on the visible image loading (and decoding
where `Image.decode` exists), then prepare only the next image. Keep at most
the current and next photos assigned, releasing evicted backgrounds, preloader
references and render-only Blob URLs. Remove inactive elements from layout with
`display: none` as well; empty animated elements can retain GPU surfaces.
Eagerly decoding a whole property gallery can exhaust legacy player memory.
If the next photo is not ready at its
transition, hold the fully loaded current photo and extend the slot by the wait.
Seeks must also wait for their selected visible photos before handoff.
Ordinary image components also wait for their selected background to load.
Release their image preparations on source replacement and unload. Carousel
preparation failures stay blocked until that image is evicted or rebuilt;
successful ticks for another photo must not clear the failed photo's skip timer.
Cache URL resolution or CSS background assignment alone is not readiness.
Old Crosswalk uses image load events without requiring `Image.decode`.
Image errors or a 30-second load/decode timeout report a media-load failure and
block the item for the playlist's existing skip mechanism; never mark it ready.
All declared fonts must finish loading and join `document.fonts` before rendering
the template. The renderer keeps the outgoing layer until the incoming layer
emits readiness; cancellation must not commit an unfinished handoff.

Playlists with multiple items set `loopPlaylistItem: false` on their widgets.
Carousels hold the last image instead of fading back to the first, keeping the
same slot duration. Their root timelines also stop at the end so preparing the
next widget cannot briefly restart the outgoing one. Single-item playlists and
standalone previews retain the loop-back transition.

Autofitted text keeps its initial synchronous fit for readiness. Coalesce later
resize and content notifications into one animation-frame fit, using the latest
text and container dimensions, and cancel queued work on cleanup.
Install the template's resize observer before applying its initial base font:
that font update dispatches a window resize and can letterbox the layer.
Without `ResizeObserver`, observing afterward misses the initial inline-size
change and leaves portrait widgets with landscape-sized text.

The legacy adapter player displays English-only UI on Android, WebOS, and
Electron. Keep startup and diagnostics strings in English; do not add locale
files or language selection to `packages/platforms/legacy-adapter-player/`.
Dashboard localization remains separate.

### Independent control-channel recovery

The shared device `ControlConnection` keeps one five-second watchdog independent
of Phoenix's reconnect timers. It sends a device heartbeat every 30 seconds and
requires an acknowledgement; an open WebSocket alone is not healthy. After 90
seconds without a round trip it disposes the old socket and its channels, creates
a fresh authenticated connection, reinstalls listeners once, and resynchronizes
assignments/automations. Cached playback is not stopped or reloaded. Failed fresh
attempts get a 15-second connection budget plus exponential backoff (1–60 seconds).
Reuse the Phoenix owner while replacing its native WebSocket and device channel:
Phoenix installs anonymous page lifecycle handlers with no removal API, so
constructing another Phoenix owner on each attempt would leak those handlers.
Disposal also clears buffered writes and protocol heartbeat timers (even if the
native transport never emits `close`), and guards against late pageshow reconnects.
Online/foreground events nudge recovery; `Device.stop()` removes all watchdog
timers and browser listeners.

Servers advertise `heartbeat_ack: true` in the device join reply and acknowledge
the existing `heartbeat` event. Old players ignore the extra reply. With older
servers, new players explicitly fall back to correlated Phoenix protocol pongs
while requiring an authenticated joined device channel. This compatibility mode
proves transport health, not execution of the old one-way custom handler.

On recovery the existing durable Device Events reporter records
`control_connection_recovered` (`network-sync`) with the observed disconnect
duration and fresh-connection attempt count (zero when Phoenix recovered itself).
For silent failures duration starts at the last acknowledgement; it is not an
exact measurement of when the network failed. No credentials enter the report.
Physical tests can briefly drop only the custom heartbeat on the current
WebSocket, keeping Phoenix pongs and cached playback running; restore the
instrumentation afterwards. Do not modify or reinstall the Android APK.
With old servers, also drop the immediately paired compatibility probe while
allowing Phoenix's own protocol heartbeats to continue.

### Android legacy crash recovery events

The Android adapter opts into the `Device` option `reportUnexpectedExit`. A small per-device
`castmill.device-session:*` localStorage marker checkpoints every 15 seconds.
It does not use native settings or store media URLs, payloads, or credentials.
After an interrupted session, the next authenticated startup queues a
`runtime` event with code `player-unclean-exit` through the existing Device Events
error reporter. Recovery reports are persisted immediately and retain the normal
offline retry and server acknowledgement/deduplication behavior.

The report includes the previous start/heartbeat times, bounded mounted template
names and image counts, and a JS heap estimate when available. That estimate is
not native/GPU/process memory and cannot establish OOM. A fatal native crash cannot
run JavaScript: this is a **possible crash/unclean exit**, indistinguishable from
an OS kill or power loss, reported only after restart and reconnection. It cannot
recover crashes that happened before this adapter update or after storage loss.

Normal page unloads and `Device.stop()` mark the session clean. Maintenance actions
mark an expected exit before invoking the platform, with a 60-second grace period
for delayed native restarts/reboots; failed actions resume tracking immediately.
Do not silently enable this for other player types without validating their
shutdown behavior. Regression tests cover recovery delivery, ordinary refreshes,
maintenance, malformed markers and unavailable storage; verify process-loss
recovery on physical Crosswalk as well.

QR generation must work without `TextEncoder` (missing on Chromium 38).
Pass UTF-8 bytes as a QR byte segment on those engines; the encoder's string
path requires `TextEncoder`. Keep the optimized string path on modern browsers
and preserve SVG `viewBox` sizing on both.
Both Chrome 38 app builds must include `es.typed-array.slice`: the QR encoder's
error-correction code uses `Uint8Array.prototype.slice`, which is not covered by
`es.array.slice`. The bootstrap regression builds and executes both real Vite
configurations with `TextEncoder` and typed-array `slice` absent.

The legacy Android adapter and native Android app use `getBrowserLocation` from
`@castmill/device`. Geolocation is optional: use coordinates when available, but
continue registration without them on failure or after five seconds. Keep both
the browser API timeout and the independent timer for unresponsive WebViews.

The Android adapter must not send JSON/configuration or widget code through the
APK's native downloader: it assumes HEAD provides a nonnegative Content-Length
and generates byte ranges from it. `Cache` and `MemoryCache` pass the item `type`
to storage. Android uses authenticated XHR GETs for data/code and persists
versioned data URLs in IndexedDB for offline reads, without persisting headers.
Put revisions in the data URL's MIME parameters, never a `#fragment`: Crosswalk
23/Chromium 53 includes that fragment in XHR responseText, breaking JSON/code.
The fetch polyfill upgrades older fragment-versioned cache URLs while reading
them so existing offline data remains usable.
Keep its 30-second timeout, HTTP failure/206 rejection, and Range-request guard.
The legacy Android adapter renders public `https://broker.images.castmill.io`
images directly using Crosswalk's HTTP cache. It bypasses both the native
downloader (the broker omits HEAD lengths and ignores ranges) and the IndexedDB
media cache (to avoid repeated writes and evictions). It does not guarantee
offline copies for those images. Previous IndexedDB entries are not removed
by the bypass and can age out through normal cache eviction.

Fonts (`otf`, `ttf`, `woff`, `woff2`, `eot`) still bypass the native downloader.
Use full authenticated binary XHR GETs and
versioned base64 data URLs, preserving the response MIME type (or inferring it
from a recognized extension for missing/octet-stream types). Other recognized
images use the same fallback after a native download error, except `CacheFull`,
which retains normal native cache eviction. Successful native media downloads,
videos, and unrecognized media URLs keep the existing native path.

Native deletion must only receive app-owned
`content://com.optimalbits.fileprovider/cache/` file URLs. The deployed APK calls
`ContentResolver.delete` without catching Java exceptions; sending an HTTPS
fallback URL kills the entire app. Cache eviction/reconciliation can supply an
original source URL without a storage mapping. Treat unowned URLs as having no
native file, including mapped remote/data URLs and stale mapped replacements.
Keep deleting orphaned or superseded app-owned content URLs, preserve replacement
mappings, and propagate real native deletion failures before removing metadata.

Binary persistence is capped at 2 MiB per asset and 8 MiB total raw binary
bytes in the file cache (base64 adds about one-third). Abort oversized downloads
using progress bytes even when the total is unknown, and check the final Blob
size too. Reject empty, partial, non-image/font, or failed responses; never
persist session-only blob URLs. Enforce the total budget inside serialized
map writes and report capacity pressure through the cache's eviction path.
Return `result.evictableUrls` with only binary fallback source URLs (excluding
the resource being replaced). Cache must evict those entries through its normal
deletion path so metadata and the Android file map stay synchronized, without
deleting native videos, code, or channel data to satisfy the binary-only budget.
Configuration/code do not count toward that binary budget. Failed downloads,
encoding, and persistence must leave the old mapping intact.

Image carousels convert cached base64 image data URLs to temporary Blob URLs
before assigning CSS backgrounds. Megabyte-sized data URLs in animated inline
styles stall old Crosswalk during transitions. Feature-detect the Blob URL APIs,
preserve the MIME type and exact binary bytes, and revoke URLs after replacement
or carousel cleanup. These URLs are render-only: cache metadata and IndexedDB
must retain their original revisioned data URLs. This does not require storing
Blobs in IndexedDB or changing the deployed Android APK.
Overlapping carousels with the same resource manager share identical image
URLs so incoming widgets do not repeat base64 decoding. Count carousel owners
and revoke only after the last owner releases an image; do not keep an
unbounded warm cache after all owners unload.

Android's `castmill-android-files` IndexedDB database stores the complete file
map, including data URL strings and native media references. Native `FILE_MAP`
contains only a compact database pointer. Keeping payloads in native preferences
causes the unchanged APK's 30-second `LAST_SEEN` commit to serialize megabytes
of XML on the Android UI thread.

On upgrade, copy the old native map in one transaction, wait for completion,
and read it back byte-for-byte before replacing native `FILE_MAP`. Keep cached
URLs unchanged so existing `@castmill/cache` metadata and offline content still
match. A failed migration must surface the error and retain the native map for
retry. Subsequent writes/deletions are atomic IndexedDB transactions and do not
rewrite native preferences. Use cursor/request events and plain objects/strings:
do not require `getAll`, explicit transaction `commit`, or IndexedDB Blob support.
Test large payloads, migration, offline reads and process restarts on physical
Crosswalk hardware. The cache is origin-bound, and adapters predating this
migration cannot read the new native pointer; do not roll back an offline player
to an older adapter.

Large incompatible media still needs hosting that supplies accurate HEAD
lengths and actual `206` byte-range responses. The existing Android bridge
cannot set downloader headers or write arbitrary binary files, so adapter size
estimates and `Accept-Encoding` options cannot repair the native downloader.
XHR downloads require CORS permission on external hosts. Validate binary
image/font rendering, refresh, and offline restart on physical Crosswalk
hardware before release.

Do not log configuration payloads or native URLs containing auth parameters.
The native Java/downloader sources are not in this repository; the adapter
does not fix their range arithmetic.

The Android, WebOS, and Electron debug menus send the literal `console`
message to the adapter. The Android, WebOS, and Electron wrappers use file origins that
can be serialized as either `null` or `file://`, including when the referrer
is omitted. On WebOS, old engines can also lose `WindowProxy` identity for a
local `file:` message; accept that bounded fallback only for WebOS file
origins. All network-hosted parents must still match `window.parent`.
Because those same engines can miss post-mount Solid updates, mount the WebOS
debug shell during the initial render and toggle its DOM display directly. Use
the shared `LegacyDebugShell` for all adapter platforms so their diagnostics
have the same Chrome 38-compatible layout, stacking behavior, and field set.

Electron wrappers can also send `console` from `app://` or `app://.` origins
(the latter includes a literal dot). Accept these exact origins only on
Electron and only from `window.parent`; do not
extend the WebOS missing-parent exception to Electron app messages.

## JavaScript Rules

### WebOS runtime shared by native and legacy players

The native IPK app (`packages/platforms/webos-player`) and the legacy WebOS
adapter run on the same hardware. Their reusable compatibility code lives in
`webos-player/src/shared` and is exported as `@castmill/webos-player/shared`.
This is a TypeScript source subpath, not an app bundle or a separate package.
Both Vite apps compile it to Chrome 38; importing it needs no native player
build or installed SCAP libraries.

Keep shared code independent of SCAP globals, `src/native`, native machine or
storage classes, app components, CSS, and bootstrap. Shared import-boundary
tests and a no-SCAP import smoke test enforce this separation. The native
player must not depend on the legacy adapter at runtime. Preserve the tested
WebOS behavior before moving functionality: run the legacy suite first, then
both suites and their coverage checks after changes.

Both PlayerFrames inject `WebosWebSocket`, `createWebosVideoPlayback`, and
`MemoryCache`. The shared controller's default native URL predicate recognizes
64-hex names under `http://127.0.0.1:9080/castmill-cache/`; the factory supports
injecting another predicate and budget without importing platform storage.
The native player uses SCAP directly for eligible media and a validated
`castmill-webos-native-file-map` in localStorage. It reconciles missing files,
removes orphan cache files, uses atomic temporary-file downloads and SHA-256
filenames, translates recognized storage-full errors, and serves protected
resources from session XHR blobs. After an authenticated XHR download, the
native player also writes channel/playlist data and widget code (up to 5 MiB
each) to `file://internal/castmill-cache` with SCAP `writeFile` (binary
10 KB chunks, because SCAP reads and writes at most 10 KB per call and
silently truncates larger writes; the size is checked before the file is
moved into place), records the
type and download time in the file map, and restores them as blob URLs on
startup, so it can cold-start offline with the last known content. The legacy
adapter still requires an online server at cold startup. Neither player opens
IndexedDB for content caching.

The iframe bridge, wrapper heartbeat/watchdog, `console` origin handling, and
`/legacy/sw.js` are legacy-only. The native player ships its shell in the IPK,
shows a pre-mounted startup overlay, and surfaces initialization failures
through the device error reporter when available.

Native-only startup and maintenance (`webos-player/src/boot`,
`src/classes/display-maintenance.ts`):

- `scap-loader.js` loads SCAP scripts in order and exposes
  `window.castmillScapReady`. `src/native/native-api.ts` constructs SCAP
  objects at import time, so the entry point imports the app chunk only after
  that promise resolves (30 s timeout). Never import `src/native` or
  `src/classes` statically from `src/index.tsx` or `src/boot`.
- Boot or initialization failures are displayed and retried by reloading after
  1-9 minutes of linear back-off (sessionStorage counter, reset on success).
  Startup that has not mounted the player after 3 minutes counts as a failure.
- `src/classes/runtime-watchdog.ts` replaces the wrapper heartbeat: a 5 s
  interval with a monotonic clock reports a `runtime` error and reloads after a
  visible gap of 60 s or more. Hidden time is ignored.
- Telemetry adds memory (`getSystemUsageInfo`, bytes), CPU usage from deltas of
  cumulative CPU times, Wi-Fi SSID/signal (`getWifiList`, scans on demand), and
  the webOS version via `custom.js`. All optional and feature-detected.
- `Machine.clearCache` calls SCAP `Configuration.clearCache` after the content
  cache is cleaned; the reload happens even if it fails.
- Firmware images are fetched from
  `https://update.castmill.io/webos/firmware/{manufacturer}-{modelName}.epk`
  (old wrapper convention, documented in the webos-player README).
- Each start calls `Signage.setPowerSaveMode` to disable automatic standby, DPM
  and 15-minute off. A 10-minute watchdog toggles wired/Wi-Fi adapters after two
  consecutive SCAP `isInternetConnectionAvailable === false` checks, when
  `DeviceInfo.setNetworkInfo` exists. No player-scheduled reboots.
- The hardware ID is `sha256(wired || wifi MAC)`, identical to the legacy
  wrapper's `getUUid`, so migrating displays keep their registration.
- SCAP `getStorageInfo` values are KB; convert to bytes for telemetry and cache
  accounting.
- The webOS 3.x fetch fallback resolves every HTTP status (`ok` reflects 2xx)
  so callers can read error bodies such as `recovery_blocked`.

#### Device content orientation

Dashboard device Details stores numeric clockwise orientations `0 | 90 | 180 |
270` on the device record. Socket join/rejoin synchronizes desired state and
players cache successful application through Machine's `ORIENTATION` setting.
Offline saves remain pending until connection. Do not equate a saved database
value with an applied-player acknowledgement.

The Device playback stage owns an independent orientation wrapper. For CSS
90/270 rotation its logical dimensions are swapped; Renderer viewport clipping
must stay on the inner content element. Use `getLogicalSize` for widget algorithms
that require unrotated axes, preserving scale and existing local transforms.
This includes Layer aspect-ratio sizing whenever it measures without a
ResizeObserver entry (the Chrome 38 resize fallback and post-show refresh).
Live rotation/resize must recalculate auto-fit text, pages and scroll distance
without rebuilding video layers. Keep direct DOM styles and the no-ResizeObserver
fallback compatible with Chrome 38.

Both WebOS machine integrations use the shared `applyWebosOrientation` policy.
Native WebOS binds the old player's `Custom.Configuration.getNativePortraitMode`
and `setNativePortraitMode`: 0 maps to `"off"`, others to degree strings, and
unchanged native settings are not rewritten. The shipped Custom library handles
webOS 3.0 `commercial.siAppOrientation` and 3.2+ `option.screenRotation`.
Legacy WebOS sends numeric angles through the embedding player's existing
`setRotation` bridge. Native mode leaves CSS neutral and uses the native viewport;
it also rotates application/display shell UI, not just playback.
Only absent native Custom methods select CSS. Native/bridge errors and 10-second
deadlines reject; never hide a possible native change behind CSS fallback.
Do not substitute OSD portrait mode or the removed fullscreen-video rotation API.
Shared code may use type-only Machine imports, but must not import the Device
app or SCAP at runtime.
See `packages/device/README.md` and both platform READMEs.

#### Observed runtime limitations

Treat the legacy WebOS engine as a distinct Chrome 38-era runtime, not as a
modern Chromium browser. The following behavior has been observed on deployed
signage hardware and must be preserved by compatibility changes:

| Limitation | Required handling |
| --- | --- |
| IndexedDB/Dexie can fail to open or report unsupported schema/key-path behavior. | Do not open IndexedDB on WebOS. Use `MemoryCache`; persist only eligible public media through the native wrapper. |
| The player needs live channel data, code, and protected resources at startup. | Legacy adapter: start online; a service-worker app shell and native media files are not enough to start offline. Native player: data/code saved with SCAP `writeFile` allow an offline cold start. |
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
URLs. Only unsigned HTTP(S) media may enter the native downloader; other URL
schemes stay on the browser path. Authorization headers and signed URLs are
never sent to the wrapper's URL-logging file API. Native media metadata is
restored from the persisted source-to-local map; channel/playlist data and
code must be fetched again on every startup. Session-only XHR downloads fail
after 30 seconds if the request stalls. On a recognized native storage-full
error, `MemoryCache` evicts older entries and retries the write; unrelated
errors do not evict cached files.
If a previously mapped native video fails to load, the adapter invalidates its
cache entry and retries the download once, even if removing the missing native
file fails. The legacy WebOS adapter must start online even if the app shell was cached;
it does not open IndexedDB.

Both `PlayerFrame` implementations inject the shared `WebosVideoPlayback` controller for every
WebOS video, including blob and remote sources. The controller owns decoder
reloads, metadata waits, bounded seek recovery, and cancellation. Immediate
timeline seek/play calls are coalesced; a paused seek preserves its offset without
starting playback. Pause, a newer request, or disposal cancels pending work.
Metadata readiness also accepts `loadeddata`, `canplay`, or an updated
`readyState` when WebOS omits `loadedmetadata`. A decoder that remains unready
after 15 seconds reports a playback error and retries after 30 seconds while
its video is still active; pause or disposal cancels the retry. Other videos
and the layout continue independently.
Following LG's two-video-tag guidance, controllers share a decoder budget: at
most two videos keep a media source. New videos get their `src` only after the
controller's `whenLoadable()` grants a decoder. Played videos seeked while
detached, the least recently claimed paused videos beyond the budget, and
disposed videos remove their `src` and call `load()`. They restore it on their
next play. Playing, preparing, and first-loading videos are never released;
videos that cannot get a decoder wait in a queue (play requests first, then
larger videos) and signal the block through the controller context's
`setBlocked` hook. The nearest `TemplateWidget` exposes it as
`Layer.blocked$()`, and the playlist playing the item holds its clock while
the item is blocked, skips it after `BLOCKED_ITEM_SKIP_MS` (1 s), and, once
every item was skipped in a row, leaves the area empty and waits for the
decoder instead. Each skip or wait is reported as a non-fatal `playback`
error (`video-decoder-limit`) shown in the device events tab; nothing is drawn
over the video. Waiting videos of layers that were removed from the document
(for example after a channel change or a skip) are not granted a decoder
until shown again. End-to-end
(`webos-layout-playback.test.tsx`) and seeded invariant tests guard these
limits; see the adapter README for details.
The native player's suite reuses that layout harness; shared unit/invariant
tests now live in `webos-player/src/shared`. Keep Vitest test files isolated
because WebOS tests disable IndexedDB while other platform tests require it.

```bash
yarn workspace @castmill/legacy-adapter-player test:webos-coverage
yarn workspace @castmill/webos-player test:webos-coverage
yarn workspace @castmill/legacy-adapter-player typecheck
yarn workspace @castmill/webos-player typecheck
```

Coverage commands enforce 90% statements, lines, branches, and functions for
shared/new WebOS integration files. Rebuild both apps after shared changes.
The video widget waits for `canplay` or `canplaythrough`, but accepts
`loadedmetadata`, `loadeddata`, or metadata visible in `readyState` at the
bounded readiness deadline to register and start WebOS videos without either
playability event. Final failures use the existing player error reporter.

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

Encode QR codes with the `qrcode` package's core encoder
(`qrcode/lib/core/qrcode`, already shipped to legacy players by the device
registration screen); never hand-roll the encoding. Render them as SVG rather
than a CSS Grid:

```tsx
<svg
  viewBox={`0 0 ${size} ${size}`}
  preserveAspectRatio="xMidYMid meet"
  shape-rendering="crispEdges"
>
  <rect width={size} height={size} fill={backgroundColor} />
  {/* One path: each horizontal run of dark modules is one subpath */}
  <path d={path} fill={foregroundColor} />
</svg>
```

A single path keeps the DOM small on old players, and `crispEdges` prevents
Chrome from antialiasing adjacent module edges into thin visible seams.
`tests/qr-code.spec.ts` checks the drawn modules against the reference encoder.

Use template conditional styles (`$styles`) for state-dependent layouts, such as
hiding an empty QR caption and expanding the QR card. Ensure every component that
uses `$styles` preserves `json.$styles` in its `fromJSON` implementation; otherwise
the template data reaches the player but its conditional style is silently dropped.

## Paginated Media Posts

Lists containing videos must opt into `paginated-list`'s `activeOnly: true` and
use `pageSize: 1`. The normal animated list mounts every page and can exhaust
hardware decoders. Active-only lists mount one page, release its media before
mounting the next, and cut between posts. Existing lists keep their animated
behavior unless explicitly opted in. The page-local timeline loops video within
its slot; the parent timeline owns page timing, pause and seek. Video components
can set `opts.muted: true`; a global preview mute cannot be overridden.
Use `opts.loop: true` to loop video independently of longer text-scroll timelines;
this repeats the video timeline item and enables the native media loop flag.
Validate actual visible frames and mixed media loops on old hardware.

Active-only lists can opt into `transition: "slide-left"`. The next page is
mounted hidden 3 s before it is due and both pages stay mounted until the slide
ends, so a list of videos briefly needs two decoders; keep cuts (the default)
for video posts on WebOS/old Android unless validated on hardware. The slide
animates gsap `xPercent` transforms, which Chrome 38 supports. `pageDuration:
"auto"` reads each page's timeline duration and `resume` keeps the position in
memory only (a restart begins at the first page).

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
