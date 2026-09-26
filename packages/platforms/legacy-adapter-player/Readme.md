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
Failed native video loads invalidate their cache entry and retry the download
once, so a deleted native file is not retained across future playback. Errors
use the existing player error reporter. Protected resources use in-memory
blob URLs instead of the wrapper's native downloader.

Seek/play offsets are milliseconds. Immediate seek/play pairs are coalesced;
seek-only requests never start playback. New requests, pause, and disposal cancel
pending work so a late metadata event cannot resume obsolete playback. Shared
player code retains rendering, loading, duration, and timeline ownership. Android,
Electron, browser players, and dashboard previews do not receive this override.

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
