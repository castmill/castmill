---
sidebar_position: 1
title: Players overview
description: Choose a Castmill player for your screens, register it with your organization, and prepare the network it needs.
---

# Players overview

A player is the application that runs on a screen and shows Castmill content. It connects to your Castmill server, downloads the channels, playlists, widgets, and media assigned to the device, stores them locally, and plays them on a schedule. You manage registered players from the dashboard, as described in [Devices](../dashboard/devices.md).

Every player is built on the same shared runtime, so registration, scheduling, caching, the on-screen menu, and error reporting work the same way on every platform. The platforms differ in how they are installed, which maintenance actions they support, and whether they can start without a network connection.

## Platform comparison

| Platform | Minimum OS or hardware | Package format | Offline cold start | Native rotation | Maintenance actions |
| --- | --- | --- | --- | --- | --- |
| [Browser](browser.md) | A current desktop browser | None (served by the Castmill server) | No | No (CSS rotation) | Refresh, clear cache, restart app (reloads the page) |
| [Android](android.md) | Android 5.1 (API 22) | APK | Yes | No (CSS rotation) | Refresh, clear cache, restart app, quit, reboot (rooted or managed hardware only) |
| [LG webOS Signage](webos.md) | LG webOS Signage 3.0 or newer (SCAP 1.5 on 3.x, SCAP 1.7 on 4.0 and newer) | IPK | Yes | Yes | Refresh, clear cache, restart app, reboot, shut down, app update, firmware update |
| [Electron](electron.md) | macOS or Linux computer | DMG (macOS); AppImage, snap, deb (Linux) | Yes | No (CSS rotation) | Refresh, clear cache, restart app, quit, reboot, shut down, app update |
| [Legacy adapter](legacy-players.md) | Older Castmill Android (Android 5.1), Electron, and webOS players | None (served by the Castmill server at `/legacy`) | Android and Electron: yes, after one online start. webOS: no | webOS: yes. Android and Electron: no | Varies by wrapper; see [Legacy players](legacy-players.md) |

Notes on the table:

- **Offline cold start** means the player can be switched on without a network connection and still play the content it downloaded during an earlier online session. All players keep playing cached content when the network drops while they are running. See [Offline playback and caching](offline-and-caching.md).
- **Native rotation** means the display hardware rotates the picture. Other players rotate the playback area with CSS. Both use the orientation saved in the dashboard.
- On Android, **Check for updates** and shutdown are reported as available but do not do anything yet.
- In the dashboard, a maintenance action the player does not support is marked **Not supported.** on the device's **Maintenance** tab. Quit and shut down are only available from the [on-screen menu](on-screen-menu-and-debugging.md).

Before a maintenance action runs, the player shows a short message on the screen, for example **Rebooting** or **Clearing cache**. If the action fails, the player shows a failure message such as **Reboot failed** and reports the error to the device's **Events** tab.

## How registration works

A new player does not belong to any organization. It asks the Castmill server for a pincode and shows it on screen until someone registers it in the dashboard.

1. Install and start the player on the screen. It connects to its configured Castmill server and shows **Register Your Device** with a 10-character pincode and a QR code.
2. In the dashboard, open **Devices** and select **Add Device**.
3. In the **Register device** dialog, enter a **Name** for the screen and the **Pincode** shown on the screen. Pincodes are not case-sensitive.
4. Select **Register**.

The player receives its credentials over its WebSocket connection, reloads, and starts playing. Dashboard registration automatically creates a channel for the device with a welcome playlist; you can replace that channel or add others from the device's **Channels** tab. A registration that does not request a default channel needs one assigned before the player can show content. See [Channels](../dashboard/channels.md) and [Your first screen](../getting-started/first-screen.md).

Instead of typing the pincode, you can scan the QR code with a phone. It opens the dashboard, asks you to log in if needed, and opens the registration form with the pincode filled in.

A pincode expires one hour after the player requested it. If registration fails because the pincode has expired, restart the player to get a new one. See [Troubleshooting](troubleshooting.md#the-pincode-is-not-shown-or-has-expired).

### Device identity and recovery

Each player identifies its hardware with a stable ID:

- webOS and Electron players use a SHA-256 hash of the network adapter's MAC address.
- Android players use the device identifier reported by Android.
- The browser player generates a random ID and stores it in the browser's local storage.

If a registered player loses its stored credentials, for example after its application data is cleared, it requests a pincode again. The server recognizes the hardware ID and restores the existing registration automatically when the request comes from the device's last known IP address, or when **Recover lost settings** is enabled on the device's **Maintenance** tab. Otherwise the screen shows **Automatic recovery is blocked** until you enable recovery in the dashboard.

When you delete a device in the dashboard, an online player shows **Device removed, resetting**, clears its credentials and cache, and returns to the registration screen.

## Network requirements

Players use outbound connections only. Allow the following from the screen's network:

| Destination | Protocol | Used for |
| --- | --- | --- |
| Castmill server origin, for example `https://castmill.example.com` | HTTPS | Registration, channel, playlist, and widget data, device information |
| Castmill server WebSocket endpoint, for example `wss://castmill.example.com/socket` | WebSocket over TLS | Registration, live updates, maintenance commands, heartbeats every 30 seconds, error reports |
| Media storage host | HTTPS | Media files. This is the Castmill server, the address set in `MEDIA_PUBLIC_BASE_URL`, or the S3 bucket, depending on how the server is configured |
| External sources used by your widgets | HTTPS | Content such as feeds or web pages that widgets load directly |
| Update servers (optional) | HTTPS | Application and firmware updates. See the platform pages |

Additional requirements:

- Reverse proxies and load balancers in front of the server must allow WebSocket upgrades on `/socket`. Without them, players can download content but appear offline and do not receive commands. See [Self-hosting](../administration/self-hosting.md).
- Media URLs must be reachable from the screen. A URL containing `localhost` or a container hostname points to the screen itself and fails. Set `MEDIA_PUBLIC_BASE_URL` on the server as described in [Configuration](../administration/configuration.md).
- Use HTTPS with a certificate the screen trusts. Old players, such as webOS Signage 3.x displays and Android 5.1 devices, may not trust recently issued root certificates.
- The screen's clock must be correct. Channel schedules are evaluated against the device clock. Enable network time (NTP) on the device.

When the connection drops, the player keeps playing cached content and reconnects with an increasing delay of up to 60 seconds between attempts.
