---
sidebar_position: 4
title: LG webOS Signage player
description: Build, install, and update the native Castmill player for LG webOS Signage displays.
---

# LG webOS Signage player

The webOS player is a native web application (IPK) for LG commercial displays running webOS Signage. It uses LG's Signage Control API (SCAP) for storage, power, timers, telemetry, rotation, and updates. It targets webOS Signage, not LG's consumer webOS TV platform.

| Property | Value |
| --- | --- |
| Supported displays | LG webOS Signage 3.0 and newer |
| SCAP version | 1.5 on webOS Signage 3.0 and 3.2, 1.7 on webOS Signage 4.0 and newer |
| Application ID | `com.lg.app.signage` |
| Launcher title | **Castmill Player** |
| Package format | IPK |

Displays that still run the older Castmill webOS wrapper can use the [legacy adapter](legacy-players.md) instead. Both use the same hardware ID, so a display keeps its registration when it moves from the legacy adapter to this player.

## Features

- **Offline cold start.** Public media is stored in the display's internal storage. Channel and playlist data and widget code up to 5 MiB per file are also written to internal storage, so the display can start without a network connection and play its last content.
- **Native rotation.** The orientation set in the dashboard is applied by the display, including the system UI, instead of with CSS. A rotation that fails or does not answer within 10 seconds is reported as an error. The display is not rebooted to apply it.
- **Maintenance.** Restart app, reboot, shut down, application update, and firmware update. Clear cache also clears the display's browser cache. Credentials and settings are kept.
- **Power schedule.** On and off timers from the device's **Schedule** tab in the dashboard are written to the display's hardware timers. The player never schedules reboots on its own.
- **Telemetry.** Model, webOS version, firmware, storage, memory, CPU, temperature, fan, and network information (including Wi-Fi network name and signal) where the display supports it.
- **Self-recovery.**
  - Every start disables automatic standby and other power-saving modes that would turn the display off.
  - Every 10 minutes the player checks the internet connection. After two failed checks it turns the network adapters off and on again (requires a SCAP version with `DeviceInfo.setNetworkInfo`).
  - The app reloads if startup takes longer than 3 minutes or the page stops responding for 60 seconds. After repeated startup failures it waits one more minute after each failure, up to nine minutes, before retrying.
- **Video decoder limit.** webOS displays can only load two videos at a time. When a layout needs more, the extra video waits or is skipped after one second, and the player reports a `video-decoder-limit` event. Reduce the number of simultaneous videos if you see this event.

## Prerequisites

- The Castmill repository with dependencies installed (`yarn install` at the repository root).
- The LG webOS CLI:

  ```bash
  npm install --global @webos-tools/cli
  ares-config --profile signage
  ```

  The CLI defaults to the consumer TV profile. Check the active profile with `ares-config --profile-details` before you deploy.

- The SCAP 1.5 and 1.7 libraries, downloaded from the [LG webOS Signage developer site](https://webossignage.developer.lge.com/). They are not distributed with Castmill.
- A display with developer access enabled, or a webOS Signage emulator.

## Install the SCAP libraries

Extract both SCAP versions into `packages/platforms/webos-player/public/lib/` so that you have `public/lib/scap_1.5/` and `public/lib/scap_1.7/`, each with a `cordova/2.7.0/cordova.webos.js` file and a `cordova-cd/` directory. The directories are ignored by Git.

The build fails when the libraries are missing, because the player would otherwise fail on the display. Keep both versions in the package if you support several display generations. The player selects the right one at startup.

## Configure the server address

The server options are compiled into the shared `@castmill/device` package, not into this app. Set them in `packages/device/.env.local`:

```dotenv
VITE_PRODUCTION_BASE_URL=https://castmill.example.com
VITE_DEFAULT_BASE_URL=https://castmill.example.com
```

The variables and the selection order are the same as for the [Android player](android.md#configure-the-server-address). The display saves its selected server in `file://internal/castmill-BASE_URL.txt`, and a new build-time default does not replace it.

Settings for this app go in `packages/platforms/webos-player/.env.local`. Create it from the template:

```bash
cd packages/platforms/webos-player
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `VITE_FILE_HOST` | Replaces `localhost` in media URLs before the display downloads them. Use it in development when the server returns `localhost` URLs |
| `VITE_LOGGING` | Set to `true` to log `[webOS Video]` and `[webOS Storage]` traces to the console |
| `VITE_DEBUG_OVERLAY` | Set to `true` to show the [playback debug overlay](on-screen-menu-and-debugging.md#playback-debug-overlay) at startup |

## Build the IPK

Build the device package and the player, then package the IPK:

```bash
yarn workspace @castmill/device build
cd packages/platforms/webos-player
yarn build
yarn package
```

The IPK is written to `build/`, for example `build/com.lg.app.signage_2.0.0_all.ipk`. `yarn package` creates an unsigned IPK. To sign it, run `ares-package` with `--sign` and `--certificate`, as described in `packages/platforms/webos-player/README.md`.

## Install on a display

Add the display as a target. Port `9922` and user `prisoner` are the Signage profile defaults:

```bash
ares-setup-device \
  --add castmill-display \
  --info "host=192.168.1.50" \
  --info "port=9922" \
  --info "username=prisoner"
```

Replace `192.168.1.50` with the display's IP address. If the display uses Secure Developer Mode, retrieve its key with `ares-novacom --getkey --device castmill-display`.

Install and start the player:

```bash
ares-install build/com.lg.app.signage_2.0.0_all.ipk --device castmill-display
ares-launch com.lg.app.signage --device castmill-display
```

The player starts with the **Register Your Device** screen. Register it as described in [Players overview](overview.md#how-registration-works).

## Update the player

For a fleet, install updates from an update server instead of the CLI:

1. Increase `version` in both `public/appinfo.json` and `package.json`, then build and package a new IPK.
2. Publish the IPK at a stable HTTPS URL that the displays trust, for example `https://updates.example.com/webos/player.ipk`. The URL must download the file without authentication or redirects to a login page.
3. Configure that URL as the application update server on each display, using the display's installer menu, LG SuperSign, or SCAP.
4. Run **Check for updates** on the device's **Maintenance** tab in the dashboard, or **Update App** from the [on-screen menu](on-screen-menu-and-debugging.md).

The display downloads the IPK from its configured update server, installs it, and reboots. The player never changes the update server setting.

## Update the firmware

**Update Firmware** in the dashboard downloads the LG firmware image for the display's exact model from:

```text
https://update.castmill.io/webos/firmware/{manufacturer}-{modelName}.epk
```

`manufacturer` and `modelName` are the values the display reports, for example `LG-55XS2E-BH.epk`. The name is case-sensitive, and each model needs its own file. The display needs at least 1 GB of free internal storage. After the download completes, the display installs the firmware and reboots. If anything fails, the command is reported as failed in the dashboard.

## Debugging

The current build is inspectable. Open a remote Web Inspector:

```bash
ares-inspect com.lg.app.signage --device castmill-display --open
```

Other useful commands:

```bash
ares-install --list --device castmill-display
ares-launch --running --device castmill-display
ares-launch --close com.lg.app.signage --device castmill-display
```

On the remote control, the Back key closes the on-screen menu.

## Platform notes

- A desktop browser has no SCAP. Storage, power, timers, updates, and rotation can only be tested on a display or emulator.
- The player targets Chrome 38 so that it runs on the oldest supported displays. Validate changes on real hardware and check that video frames actually appear on screen.
- Clearing the display's application data removes the credentials. The display must then be registered again.
