---
sidebar_position: 7
title: Offline playback and caching
description: Understand what Castmill players store locally, how they behave without a network connection, and how to inspect and clear the cache.
---

# Offline playback and caching

Castmill players download everything they need to play and keep it in a local cache. A player that loses its network connection keeps playing the content it has, and synchronizes again when the connection returns.

## What the player caches

The cache has three kinds of entries, which match the sub-tabs of the **Cache** tab in the dashboard:

| Type | Contents |
| --- | --- |
| **Data** | The device's channels and the playlists they schedule |
| **Code** | Widget code |
| **Media** | Images, videos, and other files used by playlists and widgets |

Each player stores the cache in the storage available on its platform: app file storage on Android, the file system on Electron, internal storage on webOS, and browser storage for the browser player. The player also stores its credentials, selected server, orientation, and power schedule separately from the cache. Clearing the cache does not remove them.

The cache holds up to 1,000 entries. When it is full, or the device runs out of storage space, the player removes the least recently used entries first.

## How content is kept up to date

- When the player starts or reconnects, it downloads the device's channels again.
- Changes to channels are pushed to the player over its WebSocket connection while it is online.
- Each time the player schedules the next round of content, it downloads the current playlist again. If the download fails, it uses the cached copy.
- Media files are downloaded the first time a playlist uses them and reused afterwards.

When several channels are assigned to a device, the player takes turns between them: it plays the playlist that is currently scheduled on the first channel, then the one on the next channel, and so on. See [Channels](../dashboard/channels.md).

## Behavior without a network connection

| Situation | Behavior |
| --- | --- |
| Network drops while the player runs | Playback continues from the cache. The player retries the connection with an increasing delay of up to 60 seconds. The dashboard shows the device as offline |
| Player starts without a network connection | Android, Electron, and native webOS players start with the cached channels, playlists, widgets, and media. The browser player and the legacy webOS adapter cannot start until the server is reachable |
| Content was never downloaded | A playlist or file the player has not downloaded before cannot play offline. Let new content play once while the player is online, or keep the player online after assigning it |
| Connection returns | The player reconnects, downloads the channels again, and continues with the current schedule. Commands sent from the dashboard while the device was offline are not delivered |

Errors that occur while the player is offline are stored on the device and sent to the dashboard when it reconnects. See [On-screen menu and debugging](on-screen-menu-and-debugging.md#device-events-and-error-reporting).

The native webOS player keeps channel and playlist data and widget code up to 5 MiB per file in internal storage. Larger responses and protected media are only kept for the current session, so they are not available after an offline restart. See [LG webOS Signage player](webos.md).

## Inspect the cache

Open the device in the dashboard and select the **Cache** tab. It lists the entries the player reports in the **Data**, **Code**, and **Media** sub-tabs, with columns for **Timestamp** (when the entry was last stored or used), **URL**, **Size**, **Accessed** (how many times the player has used the entry), and **MIME Type**. The device must be online; otherwise the tab shows that cache information cannot be retrieved.

From the **Cache** tab you can:

- Delete individual entries or a selection of entries. The player downloads them again the next time it needs them.
- Select **Clear Entire Cache** to remove all data, code, and media entries. The player reloads afterwards.

See [Devices](../dashboard/devices.md) for the rest of the device page.

## Clear the cache

Clear the cache when a player shows outdated or damaged content, or after you replace a media file and want to force a fresh download. Use one of these options:

- **Clear Cache** on the device's **Maintenance** tab.
- **Clear Entire Cache** on the device's **Cache** tab.

The player shows **Clearing cache** on the screen, removes its cached content, and reloads. On webOS, it also clears the display's browser cache. Credentials and settings are kept, so the player does not need to be registered again. It downloads its content again, which can take some time and uses bandwidth.

:::caution
Do not clear the cache on a player that has a slow or unreliable connection unless necessary. Until it downloads its content again, it has nothing to play if the connection drops.
:::
