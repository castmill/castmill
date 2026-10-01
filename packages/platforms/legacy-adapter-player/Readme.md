# Castmill Legacy Adapter

The **Castmill Legacy Adapter** is a bridge designed to support legacy Castmill Electron and Android players by providing compatibility with their API expectations, while leveraging the functionality of the modern Castmill player. This adapter allows you to seamlessly transition from the old Castmill implementation to the new player, maintaining compatibility for older embeds.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Usage](#usage)
- [Serving from Castmill](#serving-from-castmill)
- [Migration rollout](#migration-rollout)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The Castmill Legacy Adapter enables old Castmill Electron and Android players to connect to a new Castmill server without changing those players. It preserves the legacy player APIs and adapts them to the modern Castmill player and server.

### Key Purpose:

- Allow existing legacy Castmill players to connect to new Castmill deployments.
- Maintain compatibility with the Electron and Android legacy player APIs.
- Enable migration to the modern player without disrupting existing workflows.

---

## Features

- **Legacy API Support**: Implements the APIs required by legacy players.
- **Modern Player Integration**: Uses the new Castmill player internally.
- **Seamless Transition**: Allows legacy embeds to function as expected without updates.
- **Castmill Server Deployment**: Served at `/legacy` by the Castmill Phoenix server.
- **Configurable Base URL**: Easily configure the default base URL using environment variables.
- **Legacy Debug Overlay**: The Android, WebOS, and Electron shells' existing debug
  menu toggles an adapter-owned diagnostics panel over playback.
- **Offline App Shell**: A service worker preserves the last complete adapter
  release; WebOS still needs an online server for channel data and code.

---

## Usage

1. Build the Castmill server image or run `yarn build:server` from the repository root.
2. Open the adapter at `https://<castmill-server>/legacy`.
3. Test the functionality of legacy players to ensure smooth operation with the new Castmill player.

---

## Serving from Castmill

The production Castmill build runs this workspace's `build:server` script. It generates
the adapter in `packages/castmill/priv/static/legacy/`, which Phoenix serves as:

| URL                | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `/legacy`          | Legacy adapter entry page                     |
| `/legacy/assets/*` | Adapter JavaScript and other generated assets |
| `POST /legacy/log` | Legacy WebOS wrapper ping and batched logs (JSON `payload`) |

The WebOS wrapper sends `{"payload":"Ping"}` for connectivity checks and
`{"payload":{"logs":[...]}}` for diagnostics. The endpoint accepts up to 50
entries and a 32 KiB encoded payload per batch without a browser session or CSRF token.
The server accepts at most 60 valid log submissions per minute per connection IP;
additional requests receive HTTP 429.
WebOS does not use IndexedDB: it starts online to fetch channel and playlist
data and code into memory. Eligible media persists through the wrapper's native
file API. A cached app shell alone is not sufficient for offline WebOS startup.
The legacy WebOS browser also has nonstandard file-wrapper message origins,
intermittent media readiness events, and unreliable post-mount reactive DOM
updates. Keep WebOS-specific compatibility behavior in this adapter; see
`agents/packages/player/LEGACY-PLAYER-COMPATIBILITY.md` for the complete
limitations and required fallbacks.

Use `yarn build` for a standalone workspace build, or `yarn build:server` to generate
the files for the Castmill server. The server-targeted build uses `/legacy/` as its Vite
base URL, so generated assets load from the same Castmill server.

---

## Migration rollout

During migration, the old Castmill player server proxies migrated players to `/legacy`
on the new Castmill Phoenix server. This allows individual legacy players to use the new
server while the old player domain continues to serve players that have not migrated.

After all players have migrated, point the old player domain at the new Phoenix server.
The Phoenix server must then serve the same legacy adapter content for requests received
through that domain as it does for `/legacy`.

---

## Configuration

### Base URL Configuration

The adapter allows you to configure a default base URL by setting the `VITE_BASE_URL` environment variable in a `.env.local` file. This ensures flexibility when running the adapter in different environments.

When Phoenix serves the adapter from `/legacy`, the adapter uses the page origin
as its API URL. `VITE_BASE_URL` is used by the standalone Vite development
server.

1. Create a `.env.local` file in the project root if it doesn’t already exist.
2. Add the following line to specify the base URL:

   ```env
   VITE_BASE_URL="http://192.168.1.1:4000"
   ```

   Replace `http://192.168.1.1:4000` with the appropriate base URL for your setup.

3. Build and restart the server for the changes to take effect:
   ```bash
   yarn build && yarn serve
   ```

This base URL will be used to adapt API calls and ensure the correct routing to the modern Castmill player.

### Media URL Configuration

The server must generate media URLs that players can reach. In particular,
`localhost` and container-only hostnames are not reachable from an Android
player. Set `MEDIA_PUBLIC_BASE_URL` on the Castmill server to its public origin:

```env
MEDIA_PUBLIC_BASE_URL="http://192.168.1.1:4000"
```

This setting applies when media is processed, so existing media with stored
unreachable URLs must be reprocessed after changing it.

The Android adapter gives every rewritten cached resource a new native filename.
This changes its `content://` URI and prevents Crosswalk from reusing stale
in-memory channel or playlist JSON after a refresh.

The WebOS adapter downloads public `/medias/` files and unsigned external media
(including videos) through the legacy wrapper's native file API. It persists
only source and local playback URLs, never auth tokens, for media restoration
and deletion. Protected device resources, URLs with query parameters, and
same-origin media outside this public static path use authenticated XHR and
session-only blob URLs. Channel/playlist JSON and code are also held only in
memory. WebOS requires a reachable server at startup even if the app shell and
native media are cached; it never opens IndexedDB.

### WebOS video playback

The WebOS platform selects `src/classes/webos-video-playback.ts` through the
optional `createVideoPlaybackController` Device/player hook. Each video gets its
own controller, regardless of whether its source is a native cache URL, blob, or
remote URL. The adapter handles metadata waits, decoder reloads on replay, and
one retry for a recoverable seek failure. Metadata waits time out after 15 seconds;
the widget also has a bounded fallback when WebOS never emits `canplaythrough`.
The controller also recognizes `loadeddata`, `canplay`, and updated `readyState`
if `loadedmetadata` is missing. A video whose decoder still times out retries
after 30 seconds while it remains active; pause or disposal cancels the retry.
Other videos and the layout continue independently.
The dashboard stores each video item's length when it is inserted or its video
changes. Items without a stored duration use a 10 s slot until their metadata
loads, and the shared player then refreshes durations at the next loop. See `agents/packages/player/README.md`
("Loop Duration Refresh").
Failed native video loads invalidate their cache entry and retry the download
once, so a deleted native file is not retained across future playback. Errors
use the existing player error reporter. Protected resources use in-memory
blob URLs instead of the wrapper's native downloader.

Seek/play offsets are milliseconds. Immediate seek/play pairs are coalesced;
seek-only requests never start playback. New requests, pause, and disposal cancel
pending work so a late metadata event cannot resume obsolete playback. Shared
player code retains rendering, loading, duration, and timeline ownership. Android,
Electron, browser players, and dashboard previews do not receive this override.
WebOS skips a paused seek to zero when its decoder is already unready and at zero;
loading that inactive video during a handoff can occupy the native decoder while
the next video plays. A later play still reloads the video normally. A play
request that jumps a visible, decoded video back by at least 1 s to an offset
under 1 s waits 250 ms before reloading or seeking: a widget timeline can
wrap just before its playlist slot ends, and an immediate reload would blank the
outgoing layer while the next video starts. Reused videos at their first frame
reload immediately: WebOS reloads a detached video by itself, but playing that
element without another `load()` can leave `currentTime` stuck at zero.
While a video plays, a watchdog checks its position every 500 ms. If it stops
advancing for 2 s before the last 0.5 s of the video, the controller reloads it
once and resumes at the position the playlist expects (last position plus stall
time). WebOS can keep reporting `playing` after other videos reload and take its
decoder. A second stall in the same slot is only logged; the next play request
allows a new recovery.

LG webOS Signage supports gapless playback with at most two loaded video tags,
but the player keeps one `<video>` per playlist item, and the device queues two
copies of the channel playlist. The controllers therefore share a decoder
budget (`WebosDecoderBudget`, `MAX_LOADED_VIDEOS = 2` for all WebOS models for
now) so that at most two videos hold a media source:

- A new video does not get its `src` until it holds a decoder: the widget waits
  for the controller's `whenLoadable()` before assigning the source. Otherwise
  its first metadata load would use a third decoder alongside the two current
  videos and stall the videos on screen.
- A video that has played and is seeked while its layer is detached from the
  document (the playlist rewinds an unloaded layer) releases its source: the
  controller removes the `src` attribute and calls `load()`. Otherwise WebOS
  reloads the detached video by itself and competes with the video on screen.
- A video that needs to load, seek, or play claims the budget. If both decoders
  are taken, the controller releases paused videos, detached ones first and
  then the least recently claimed. Playing videos, videos preparing a seek or
  play, and new videos still loading their first metadata (up to 15 s) are
  never released. A loaded video that has not received a request yet is only
  released for a play request.
- If no decoder can be released, the video waits in a queue
  (`waiting for decoder`) and is marked as blocked for the player (see
  below). When a
  holder pauses or finishes loading, the decoder goes to queued play requests
  first, then to the largest waiting video, then in arrival order
  (`decoder granted`). Pausing a waiting video removes its play request.
  The hand-off runs after the pausing call returns, so a renderer that pauses
  a layer and then removes it does not grant a decoder to that layer.
- Waiting videos whose layer is no longer in the document (for example after
  a channel change, or a skipped playlist item) are skipped. The budget checks them again every second
  and grants them a decoder once their layer is shown again. A loaded,
  unrequested video whose layer was removed can be released for any load.
- A released video restores its source on its next play or non-zero seek
  (`calling load reason=released`). Its reload costs the same as the restart
  reload of a reused video.
- Disposing a controller releases its source.

This avoids decoder contention but does not preload the next video, so a short
load gap between videos remains.

A waiting video signals the block through the player's `setBlocked` controller
hook; nothing is drawn over the video, and no widget template or database
changes are needed. The playlist that plays the video's item (a layout zone
or the channel playlist) then:

- Holds its clock while the item is blocked, so a short wait, such as a
  handoff while the previous video pauses, only delays the item instead of
  cutting it short.
- Skips the item once it has been blocked for `BLOCKED_ITEM_SKIP_MS` (1 s)
  and starts the next item at once, with its full duration. The previous item
  stays on screen during that second. The skipped video keeps its place in the
  decoder queue and is tried again on its next turn.
- If every item of the playlist has been skipped in a row (for example a zone
  with a single video, or with only blocked videos), stops skipping: the area
  is left empty and the item plays as soon as a decoder is free.

Each skip, and each switch to waiting, is reported through the player error
reporter, so it appears in the dashboard's device events tab. The report has
category `playback` and code `video-decoder-limit`. Its message says that the
player tried to play more simultaneous videos than the device supports, that
the blocked video was skipped or delayed, and that the number of simultaneous
videos should be reduced. Reporting does not stop playback. Skipping and
waiting shift a playlist off its schedule until it restarts (for example on
the next layout loop), so synchronized playback between devices can drift
meanwhile.

#### Regression tests

`yarn workspace @castmill/legacy-adapter-player test` runs two suites that
guard the decoder budget:

- `src/components/webos-layout-playback.test.tsx` renders real content (the
  player, layouts with video playlists, the video widget, and the WebOS
  controller) against a simulated media stack with fake timers. Every 100 ms
  it asserts that at most `MAX_LOADED_VIDEOS` video tags hold a source or
  play. It also checks that the number of video tags stays the same from loop
  to loop, that videos play their full duration in order, that layout loops
  keep their period, that crowded layouts report `video-decoder-limit` without
  stopping playback, that blocked videos are skipped in zone and channel
  playlists (or waited for with an empty area when nothing else can play),
  that short handoff waits are not skipped, and that a cleared or replaced
  channel frees every decoder.
- The `WebosDecoderBudget invariants` tests in
  `src/classes/webos-video-playback.test.ts` run seeded random sequences of
  loads, seeks, plays, pauses, layer removals, and disposals. After every step
  they check the limits, then check that requested videos still get to play.

Add a scenario to these suites whenever playback, rendering, or layer handling
changes in a way that could create, load, or keep video tags.

To trace WebOS video playback, build the adapter with `VITE_LOGGING=true` and
inspect the browser console for `[WebOS Video]` messages. Logs are compact and
event-driven, and include the source type only for non-native media, never the
full media URL, which may contain credentials. Each line has the form:

```text
[WebOS Video] 17:21:52.537 #2 event=playing duration=20.8 videos=1/1 | rs=4 ns=2 pos=0 play=44ms
```

- `17:21:52.537` is UTC time and `#2` is the controller ID.
- After `|`: `rs` is `readyState`, `ns` is `networkState`, `pos` is
  `currentTime`, then `paused`/`ended` flags when set, then milliseconds since
  the latest play request (`play=`) and decoder load (`load=`) when active.
- Logged events: play/seek requests (near-identical repeated timeline seeks are
  omitted), `pause`, `calling load reason=…` (`restart`, `released`,
  `stalled`, `ended`, `unready`, `seek-rejected`), `released decoder reason=…`
  (`detached`, `budget`, `dispose`), `waiting for decoder decoders=N waiting=N`,
  `decoder granted`, `calling play`, `loadstart`,
  `loadedmetadata` with decoded `dims`, `playing`, `waiting`, `seeked`, `ended`, `error`, timeouts, retries,
  and native media recovery. Routine `stalled`, `canplay*`, and `timeupdate`
  events are not logged.
- Progress transitions: `progress started` on the first advance after play,
  `no progress forMs=2000` when a playing video's position stops advancing, and
  `progress resumed`. A `no progress` line right after `playing` identifies a
  video that reports playback but shows no frames. It is followed by
  `recovering stalled playback offsetMs=…` when the watchdog reloads the video.
- `playing` and `no progress` lines include the media duration and
  `videos=playing/total decoders=N` (videos holding a source, plus `waiting=N`
  when videos are queued for a decoder), and only report deviations from a visible,
  full-screen, topmost video: `detached`, `rect=…`, `hiddenBy=…` (the ancestor
  hiding the video, with its z-index), and `coveredBy=…`.

Compare the outgoing video's `pause` with the incoming video's `progress started`
to measure a handoff. Media events alone do not confirm when a frame actually
appeared on the display.

The same build logs `[WebOS Storage]` lines for native and in-memory media
downloads (start, completion time, size, and the first characters of the cached
file name) and native deletions, without media URLs. Correlate them with
`no progress` lines to see whether caching I/O coincides with a playback stall.

### Startup diagnostics

The legacy page displays a loading indicator even before its JavaScript loads,
then shows an English initialization state until device storage is ready.
Initialization errors are displayed instead of leaving a blank white screen.
WebOS cache metadata is memory-backed, so initialization does not depend on
Dexie or IndexedDB. Initialization failures log the failing step and original
stack.
The wrapper's `player_ready` message and server heartbeats indicate that the
iframe and device connection are alive; they do not mean channel loading and
player startup have completed. If startup fails, the progress overlay is
replaced by the failure message. The device reports the original error and
stack to the dashboard as a runtime error, and logs `Device player failed to
start` with the stack. Use that stack to distinguish cache initialization,
schedule loading, and channel/playlist failures from wrapper errors (including
requests to the wrapper's separate remote-control port).

### Offline startup

Production offline startup requires the adapter to be served over HTTPS from a
certificate trusted by the legacy runtime. Service workers do not register on
plain HTTP origins other than browser-local development exceptions.

The production build generates `/legacy/sw.js` from the exact Vite output. On a
successful online load, the worker downloads the complete adapter shell before
installing. A later reload uses that release's cached `index.html`, polyfills,
JavaScript, and styles if the server cannot be reached. An incomplete update does
not replace the last complete release. A complete update can activate without
reloading or interrupting the currently running page and is used on its next reload.

Offline startup has these operational requirements:

- The player must complete at least one online adapter load before it can start
  offline (Android/Electron only; WebOS requires an online server on every start).
- `/legacy`, `/legacy/index.html`, `/legacy/sw.js`, and `/legacy/assets/*` must
  remain on the same HTTPS origin.
- Reverse proxies and CDNs must preserve the
  `Service-Worker-Allowed: /legacy` response header and revalidate `sw.js`.
- Do not move an existing player between origins without migrating or re-priming
  its state. Channel and playlist metadata and browser-backed resources are
  origin-scoped.

The service worker caches only the adapter application shell. WebOS still
needs an online connection for channel data and code, even if the app shell
was cached. Legacy Android continues to store media through its native file API;
the existing IndexedDB and `FILE_MAP` metadata are both required to resolve those
files after an offline restart.

During development, a worker installed by an earlier build can keep controlling
`/legacy`. If its manifest was incomplete, remove only the generated shell worker
and shell caches while the server is online, then reload and wait for the new
worker to finish installing:

```js
await Promise.all(
  (await navigator.serviceWorker.getRegistrations())
    .filter((registration) => registration.scope.endsWith('/legacy'))
    .map((registration) => registration.unregister())
);
await Promise.all(
  (await caches.keys())
    .filter((name) => name.startsWith('castmill-legacy-shell-'))
    .map((name) => caches.delete(name))
);
location.reload();
```

Do not delete `castmill:storage:*` caches when resetting the app shell; those
contain player resources rather than the adapter release.

### Debug overlay

Selecting the debug menu option also toggles the player's playback debug
overlay. A single box in the upper right corner of each playlist or layout
area shows the playlist of that area and the playing item, each with a
progress bar and a countdown, and the next item. Build with
`VITE_DEBUG_OVERLAY=true` to enable the playback overlay at startup. For
example, `VITE_LOGGING=true VITE_DEBUG_OVERLAY=true yarn workspace
@castmill/legacy-adapter-player build:server`. From the console, call
`castmillDebugOverlay(true)` or `castmillDebugOverlay(false)`. The same
`VITE_DEBUG_OVERLAY` flag works for the Android, WebOS, Electron, and browser
players. See `agents/packages/player/README.md` for details.

Legacy Android, WebOS, and Electron shells send the literal `console` message to the
embedded player when their debug menu option is selected. The adapter accepts
that exact message only from its parent window and toggles a lower-right
diagnostics panel. Android and WebOS file wrappers may serialize their origin
as either `null` or `file://`; those origins are accepted only for those
platforms. WebOS additionally accepts `file:` variants when its legacy engine
does not preserve the parent window identity for the message.

The panel shows the registered device name and ID, organization and Castmill network,
resolved server URL, adapter platform, machine and application versions, browser and
server connection states, display dimensions, timezone, and user agent. It intentionally excludes
credentials, authentication tokens, and native hardware identifiers.
The registered player name is refreshed from the server whenever the panel is
opened, so dashboard renames appear without restarting the player.

## Legacy Android compatibility

The legacy Android player uses Crosswalk on Android 5.1 and must be treated as an
old Chromium target. Before using browser APIs or CSS layout features in shared player
code, consult
[the legacy player compatibility guide](../../../agents/packages/player/LEGACY-PLAYER-COMPATIBILITY.md).
It documents supported fallback patterns, unsupported CSS features, required build
order, and ADB validation commands.

---

## Contributing

We welcome contributions to enhance the functionality and robustness of the Castmill Legacy Adapter. Please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Submit a pull request with a detailed explanation of your changes.

---

For questions, issues, or feature requests, please open an issue in the GitHub repository.
