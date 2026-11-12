---
sidebar_position: 8
title: On-screen menu and debugging
description: Use the player's on-screen menu, the playback debug overlay, and device events to check and diagnose a screen.
---

# On-screen menu and debugging

Every Castmill player has an on-screen menu for local maintenance, a playback debug overlay for checking schedules, and error reporting to the dashboard. These tools work the same way on every platform.

## On-screen menu

Open the menu by pressing any key on a keyboard or remote control, or by clicking or touching the screen. It closes automatically 10 seconds after the last key press or touch.

| Key | Action |
| --- | --- |
| Up and Down arrows | Move between entries |
| Enter | Run the selected action or open the selected submenu |
| Escape, or Back on an LG remote control | Close the menu |

The menu shows:

- **Header:** the player's application type and version, and the operating system.
- **Actions** that the platform supports: **Restart App**, **Quit App**, **Reboot Device**, **Shutdown Device**, **Update App**, and **Update Firmware**. Actions the platform does not support are not listed. See the [platform comparison](overview.md#platform-comparison).
- **Settings** > **Server:** the server options compiled into the player. Selecting a server saves it and reloads the player. The list is empty when no server options were configured at build time.
- **Status:** **Playing** with the next scheduled off time, or **Playback turned off by timer** with the next on time, based on the device's power schedule.
- **Footer:** the first part of the device ID, the device name, the organization, and the network the device belongs to.

**Quit App** and **Shutdown Device** are only available from this menu. The dashboard does not send these commands.

## Maintenance messages

Before a maintenance action runs, whether it was started from this menu or from the dashboard, the player shows a short message on the screen. If the action fails, the player shows a failure message and reports the error to the dashboard.

| Action | Message | Failure message |
| --- | --- | --- |
| Refresh | Refreshing | Refresh failed |
| Clear cache | Clearing cache | Clearing cache failed |
| Restart app | Restarting app | Restart failed |
| Quit app | Quitting app | Quit failed |
| Reboot | Rebooting | Reboot failed |
| Shut down | Shutting down | Shutdown failed |
| App update | Checking for app updates | App update failed |
| Firmware update | Checking for firmware updates | Firmware update failed |
| Device deleted in the dashboard | Device removed, resetting | Device reset failed |

## Playback debug overlay

The debug overlay shows what each part of the screen is playing. Every playlist and every layout area gets a box in its upper-right corner with:

- the playlist name, with the progress and remaining time of the current loop;
- the current item, with its progress and a countdown;
- the next item, when it is known.

Use it to check schedules, item durations, and layouts without opening the dashboard. Turn it on in one of these ways:

| Method | How | Lasts |
| --- | --- | --- |
| URL parameter | Add `?debugOverlay=1` to the player URL, for example `https://castmill.example.com/?debugOverlay=1` for the browser player | While the URL is used |
| Browser console | Run `castmillDebugOverlay(true)`. Run `castmillDebugOverlay(false)` to turn it off | Until the player reloads |
| Local storage | Run `localStorage.setItem('castmill:debugOverlay', 'true')` in the console, then reload the player | Until the entry is removed |
| Build setting | Build the player with `VITE_DEBUG_OVERLAY=true` | Every start of that build |

To reach the console of an installed player, use remote debugging: `chrome://inspect` in desktop Chrome for the [Android player](android.md#debugging), or `ares-inspect` for the [webOS player](webos.md#debugging). For the browser player served by the Castmill server, set `VITE_DEBUG_OVERLAY=true` in the server's environment when you build it.

Legacy players open a separate diagnostics panel from the debug menu of their wrapper. See [Legacy players](legacy-players.md#diagnostics).

## Device events and error reporting

Players report problems to the dashboard. Open the device and select the **Events** tab to see connection changes and errors. Use the filters to show **Errors**, **Warnings**, **Info**, **Online**, or **Offline** events.

The player reports:

- playback failures, such as a video that cannot play or a layer that fails to show;
- media, cache, schedule, and synchronization failures;
- failed maintenance actions and orientation changes;
- uncaught errors in the player.

Each error report has one of these categories: `playback`, `media-load`, `cache`, `schedule`, `network-sync`, `runtime`, or `device`. Some reports also have a code, such as `video-decoder-limit` on webOS when a layout plays more videos than the display can decode.

Repeated errors of the same kind are grouped into one event with an occurrence count and the first and last time they were seen. Select an event to see its details, including a sanitized stack trace and the related playlist, layer, widget, or media.

Reports do not contain credentials, request bodies, or query strings. While the player is offline, it keeps up to 50 distinct errors for up to seven days and sends them when it reconnects. The server keeps the 100 most recent events per device.

The player does not send its general console log to the server. For detailed logs, connect to the player with remote debugging. The webOS players can also be built with `VITE_LOGGING=true` to log video and storage traces to the console.

## Telemetry

The **Telemetry** tab shows the hardware information the player reports, such as storage, memory, CPU, temperature, and network details. What is available depends on the platform. See [Devices](../dashboard/devices.md).
