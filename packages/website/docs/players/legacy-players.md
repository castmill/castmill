---
sidebar_position: 6
title: Legacy players
description: Connect older Castmill Android, Electron, and webOS players to a current Castmill server through the legacy adapter.
---

# Legacy players

Earlier generations of Castmill players are native wrappers that load the player as a web page. The legacy adapter lets these wrappers connect to a current Castmill server without reinstalling them. The adapter implements the API the old wrappers expect and runs the current Castmill player inside it.

The Castmill server serves the adapter at `/legacy`, for example `https://castmill.example.com/legacy`. When it is served from there, the adapter uses that same origin as its API server.

## Supported players

The adapter detects the wrapper from the browser's user agent:

| Legacy player | Runtime | Maintenance actions | Rotation | Offline cold start |
| --- | --- | --- | --- | --- |
| Android | Crosswalk on Android 5.1 | Restart app, reboot | CSS | Yes, after one online start |
| Electron | Electron wrapper | Restart app, reboot, app update | CSS | Yes, after one online start |
| webOS | LG webOS Signage wrapper | Restart app, reboot, app update | Native, through the wrapper | No, needs a reachable server at every start |

On every platform, **Refresh** and **Clear Cache** also work. For legacy Electron, **Check for updates** asks the wrapper to check its own release feed, download an available update, and quit to install it. The wrapper does not report whether an update was found.

The adapter's on-screen text is in English only.

## Moving players to a new server

During a migration, the old player server can forward individual players to `/legacy` on the new Castmill server, so you can move players in batches. When all players have moved, point the old player domain at the new server. The new server must then serve the same adapter for requests on that domain.

A legacy webOS display and the [native webOS player](webos.md) use the same hardware ID. You can replace the wrapper with the native player later without registering the display again.

## Compatibility constraints

Legacy players run old browser engines. The adapter is built for Chrome 38, and so are the core widgets (image, video, text, and layout). Keep this in mind when you create content for these screens:

- Custom widgets and web content that use modern CSS, such as CSS Grid or `aspect-ratio`, or recent browser APIs may not render.
- webOS displays can load at most two videos at a time. Layouts with more simultaneous videos cause videos to wait or be skipped, and the player reports a `video-decoder-limit` event in the dashboard.
- Test new layouts on the oldest hardware you need to support, and check that the content actually appears on screen.

## Offline behavior

On Android and Electron, the adapter installs a service worker that keeps the last complete version of the adapter. After at least one successful online start, the player can start without a network connection and play its cached content. This requires:

- The adapter served over HTTPS with a certificate the old runtime trusts. Service workers do not register over plain HTTP.
- `/legacy`, `/legacy/index.html`, `/legacy/sw.js`, and `/legacy/assets/*` on the same HTTPS origin.
- Reverse proxies and CDNs that keep the `Service-Worker-Allowed: /legacy` response header and revalidate `sw.js`.

Do not move a player to a different origin without registering it again. Cached channel data and browser storage are tied to the origin.

Legacy webOS displays keep media files in native storage, but channel and playlist data and widget code are kept in memory only. They must reach the server every time they start. Use the [native webOS player](webos.md) if displays must start offline.

## Diagnostics

The existing debug menu in the Android, webOS, and Electron wrappers opens the adapter's diagnostics panel over the playback. Startup errors are shown on screen instead of a blank page and are reported to the device's **Events** tab in the dashboard.

The legacy webOS wrapper sends connectivity pings and batched log entries to `POST /legacy/log` on the server. The server accepts at most 60 valid log submissions per minute from one IP address and writes them to its log.

## Build the adapter

The production server build generates the adapter in `packages/castmill/priv/static/legacy/`. To build it separately, run:

```bash
yarn workspace @castmill/legacy-adapter-player build:server
```

If `/legacy` returns **Legacy player not available**, the adapter was not built into the server.
