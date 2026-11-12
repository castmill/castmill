---
sidebar_position: 5
title: Electron player
description: Build and run the Castmill desktop player on macOS and Linux computers that drive a screen.
---

# Electron player

The Electron player runs Castmill as a desktop application on a computer connected to a screen, such as a small form factor PC or a Mac mini. It can run in kiosk mode, update itself from an update feed, and restart, reboot, or shut down the computer.

| Property | Value |
| --- | --- |
| Supported systems | macOS and Linux |
| Package formats | DMG (macOS); AppImage, snap, and deb (Linux) |
| Device ID | SHA-256 hash of the computer's MAC address |

## Features

- **Offline cold start.** The application and its cache are stored on the computer, so it can start without a network connection and play its last content.
- **Kiosk mode.** Production builds open full screen in kiosk mode.
- **Maintenance.** Restart app, quit, reboot, shut down, and application update. Reboot runs the system `reboot` command and shutdown runs `poweroff`, so the user that runs the player must be allowed to run them. In development builds, reboot, shutdown, and update are blocked.
- **Telemetry** for the dashboard's **Telemetry** tab.
- **CSS rotation** of the playback area when you set an orientation in the dashboard.

The player does not add itself to the system's startup items. Configure your operating system to start the player automatically when the screen's user logs in.

## Configure the build

### Server address

The server options are compiled into the shared `@castmill/device` package. Set them in `packages/device/.env.local` and rebuild that package before you build the Electron player:

```dotenv
VITE_PRODUCTION_BASE_URL=https://castmill.example.com
VITE_DEFAULT_BASE_URL=https://castmill.example.com
```

```bash
yarn workspace @castmill/device build
```

The variables and the selection order are the same as for the [Android player](android.md#configure-the-server-address). You can switch between the compiled server options from **Settings** > **Server** in the [on-screen menu](on-screen-menu-and-debugging.md).

### Application settings

The Electron app reads `.env.development` for `yarn dev` and `.env.production` for packaged builds, both in `packages/platforms/electron-player`:

| Variable | Description | Required |
| --- | --- | --- |
| `VITE_APP_TYPE` | Application type reported to the dashboard, for example `Electron` | Yes |
| `VITE_KIOSK` | `true` to open in kiosk mode | Yes |
| `VITE_FULLSCREEN` | `true` to open full screen | Yes |
| `VITE_GOOGLE_API_KEY` | Google API key with the Geolocation API enabled, used to report the device's location | No |
| `VITE_DEBUG_OVERLAY` | `true` to show the [playback debug overlay](on-screen-menu-and-debugging.md#playback-debug-overlay) at startup | No |

The production file sets `VITE_KIOSK=true` and `VITE_FULLSCREEN=true`. Without `VITE_GOOGLE_API_KEY` the player works normally but cannot report its location.

### Update feed

`CASTMILL_UPDATE_URL` sets the update feed that installed players check for new versions. It is compiled in at build time and is required. The provided build scripts set it for you:

| Script | Update feed |
| --- | --- |
| `build:staging:mac`, `build:staging:linux` | `https://updates.castmill.dev/electron` |
| `build:prod:mac`, `build:prod:linux` | `https://updates.castmill.io/electron` |
| `build:mac`, `build:linux` | Same as the staging scripts |

To use your own feed, set the variable when you call a build script:

```bash
CASTMILL_UPDATE_URL=https://updates.example.com/electron yarn build:prod:linux
```

The build scripts use POSIX shell syntax and do not run in Windows shells.

## Build from source

Run these commands from `packages/platforms/electron-player` after installing dependencies at the repository root with `yarn install`.

Run the player in development mode:

```bash
yarn dev
```

Build a package for distribution:

```bash
# macOS
yarn build:prod:mac

# Linux
yarn build:prod:linux
```

electron-builder writes the packages to `dist/`.

## Install

Install the package as usual for your system: open the DMG on macOS, or install the deb, snap, or AppImage on Linux. Start the player. It opens the **Register Your Device** screen with a pincode. Register it as described in [Players overview](overview.md#how-registration-works).

## Update the player

Run **Check for updates** on the device's **Maintenance** tab in the dashboard, or **Update App** from the on-screen menu. The player checks its update feed, downloads a newer version if there is one, and then quits, installs it, and starts again. Playback stops while the update is installed.

The update feed is a static HTTPS location in the electron-updater generic format. For Linux, it must contain `latest-linux.yml` and the package that file references, typically an AppImage, plus an optional `.zsync` file for differential updates.

## Platform notes

- To leave kiosk mode on a test machine, open the [on-screen menu](on-screen-menu-and-debugging.md) and select **Quit App**.
- If the screen must be rotated as a whole, including the desktop, use the operating system's display settings and keep the dashboard orientation at 0 degrees to avoid rotating twice.
- Disable screen blanking, sleep, and update prompts on the computer so they do not cover the player.
