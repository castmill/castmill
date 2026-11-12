---
sidebar_position: 6
title: Player library
description: The packages that make up every Castmill player, and how to embed the player or port it to new hardware.
---

# Player library

Every Castmill player, from the browser player to webOS displays, runs the same TypeScript code. A platform only adds a thin layer that talks to the hardware. This page describes that code, for developers who want to embed the player or support a new device.

## Packages

<Flow steps={["@castmill/cache|Downloads and stores files", "@castmill/player|Renders playlists", "@castmill/device|Talks to the server", "Platform|Implements Machine"]} />

| Package | Responsibility | Main exports |
| --- | --- | --- |
| `@castmill/cache` | Downloads media, widget code and data, stores them for offline use and hands out local URLs | `ResourceManager`; the `StorageIntegration` interface for file storage, with `StorageBrowser`; the `CacheBackend` index, with `Cache` (IndexedDB) and `MemoryCache` |
| `@castmill/player` | Plays playlists: timing, layers, widgets, transitions and rendering | `Player`, `Playlist`, `Layer`, `Renderer`, `TemplateWidget`, `PlayerUI` |
| `@castmill/device` | Registration, WebSocket connection, channel scheduling, automations, orientation, maintenance commands, telemetry and the on-screen menu | `Device`, `mountDevice`, the `Machine` interface, `BrowserMachine` |

The packages are part of the monorepo and are built with `yarn build:cache`, `yarn build:player` and `yarn build:device`, in that order.

## Embedding a device

The browser player is the shortest complete example. It creates a `Machine`, a storage backend and a `Device`, then renders the device:

```tsx
import { render } from 'solid-js/web';
import { StorageBrowser } from '@castmill/cache';
import { BrowserMachine, Device, mountDevice } from '@castmill/device';

const machine = new BrowserMachine();
const storage = new StorageBrowser('device');
const device = new Device(machine, storage);

await device.init();
await storage.init();

mountDevice(document.getElementById('root')!, device);
```

The device then shows a registration code, registers with the server, downloads its channels and plays them. Everything that happens afterwards, including offline playback, comes from `@castmill/device`.

## Rendering without a server

To show a single widget or playlist in your own application, for example in a preview, use `@castmill/player` directly with a `ResourceManager`:

```ts
import { MemoryCache, ResourceManager, StorageBrowser } from '@castmill/cache';
import { Playlist, Renderer, Player } from '@castmill/player';

const storage = new StorageBrowser('preview');
await storage.init();
const resourceManager = new ResourceManager(new MemoryCache(storage));
await resourceManager.init();

const playlist = Playlist.fromJSON(playlistJson, resourceManager);
const renderer = new Renderer(document.getElementById('screen')!);
const player = new Player(playlist, renderer);

player.play({ loop: true });
```

The `Device` class in `packages/device/src/classes/device.ts` shows the complete set-up, including authenticated downloads.

## Porting to a new platform

A new platform implements the `Machine` interface from `@castmill/device` and provides a storage backend. The rest is shared.

| Method | Required | Purpose |
| --- | --- | --- |
| `getMachineGUID()` | Yes | A stable, unique ID for the hardware, for example derived from the MAC address. The device hashes it before it sends it to the server. |
| `getDeviceInfo()` | Yes | Software and hardware versions shown in the dashboard |
| `storeCredentials()`, `getCredentials()`, `removeCredentials()` | Yes | Keep the device credentials received at registration in secure storage |
| `getSetting()`, `setSetting()` | Yes | Persist settings such as the server address and orientation |
| `getLocation()`, `getTimezone()` | No | Report location and timezone |
| `setOrientation()` | No | Rotate the output natively. Without it, the device rotates content with CSS. |
| `restart()`, `quit()`, `reboot()`, `shutdown()` | No | Maintenance commands |
| `update()`, `updateFirmware()` | No | Update the app or the firmware |
| `getTimers()`, `setTimers()` | No | Hardware power on and off timers. Without them, the device uses a software schedule. |
| `getTelemetry()` | No | CPU, memory, storage and network figures for the **Telemetry** tab |
| `clearCache()` | No | Platform-specific cache clean-up |

The device reports which optional methods exist as its capabilities, so the dashboard knows which actions the platform supports.

For storage, pass a `StorageIntegration` to the `Device`. `StorageBrowser` stores files with the browser's Cache API. The Android, Electron and webOS players implement `StorageIntegration` on top of the platform's file system. The device keeps its index of cached files in IndexedDB. On platforms without a usable IndexedDB, such as webOS, pass a `MemoryCache` as the `cacheBackend` option of the `Device`.

The existing platforms in `packages/platforms` are good starting points. [Players](../players/overview.md) describes what each one supports.

## Compatibility

Players run on old embedded browsers, down to Chrome 38 on legacy Android and webOS hardware. Code in these packages must not rely on modern CSS such as Grid, `gap` in flex layouts or `aspect-ratio`, and must feature-detect newer browser APIs. Check visible playback on real hardware before you release changes.
