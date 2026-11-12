---
sidebar_position: 3
title: Android player
description: Build, install, and configure the Castmill player for Android signage devices and media players.
---

# Android player

The Android player runs Castmill in an Android WebView packaged with Capacitor. It is intended for Android-based signage players, media boxes, and displays.

| Property | Value |
| --- | --- |
| Minimum Android version | Android 5.1 (API level 22) |
| Target API level | 34 |
| Application ID | `com.castmill.android.app` |
| Launcher name | **Castmill Player** |
| Package format | APK |

## Features

- Starts automatically when the device boots.
- Stores credentials, the selected server, and settings in Capacitor Preferences, and caches media in the app's file storage, so it can start offline and play the content it downloaded earlier.
- Reports device, storage, memory, battery, and network telemetry to the dashboard's **Telemetry** tab.
- Supports **Restart App**, **Quit App**, and **Reboot Device**. Restart and reboot use root commands and only work on rooted or managed signage hardware, not on standard consumer devices.
- Rotates content with CSS when you set an orientation in the dashboard.

Shutdown and application updates are not implemented yet. The dashboard's **Check for updates** action has no effect on Android; update the player by installing a new APK.

The player tries to start a separate Castmill watchdog application that restarts the player if it stops. The watchdog is not part of this repository. Without it, the player runs normally but logs watchdog errors.

## Prerequisites

To build the player from source you need:

- The Castmill repository with dependencies installed (`yarn install` at the repository root).
- JDK 17.
- Android Studio or the Android command-line tools, with SDK Platform 34 and matching build tools. Set `ANDROID_HOME` or `ANDROID_SDK_ROOT` if the SDK is not found automatically.
- `adb` on your `PATH` and a device with USB or wireless debugging enabled.

## Configure the server address

The player's server options are compiled into the shared `@castmill/device` package. Set them in `packages/device/.env.local` and rebuild that package before you build the Android player:

```dotenv
VITE_PRODUCTION_BASE_URL=https://castmill.example.com
VITE_DEV_BASE_URL=https://castmill-staging.example.com
VITE_DEFAULT_BASE_URL=https://castmill.example.com
```

```bash
yarn workspace @castmill/device build
```

| Variable | Purpose |
| --- | --- |
| `VITE_PRODUCTION_BASE_URL` | Adds a **Production** option to the player's server list |
| `VITE_DEV_BASE_URL` | Adds a **Stage** option |
| `VITE_LOCAL_BASE_URL` | Adds a **Local** option for development |
| `VITE_DEFAULT_BASE_URL` | Server used when the device has no saved selection |
| `VITE_DASHBOARD_URL` | Dashboard address opened by the registration QR code |

Use complete origins without a trailing slash. The player uses the first of these that is set:

1. The server selected earlier in the player's **Settings** > **Server** menu.
2. `VITE_DEFAULT_BASE_URL`.
3. `VITE_DEV_BASE_URL`.
4. `VITE_PRODUCTION_BASE_URL`.
5. The first configured server option.

The selection survives restarts and upgrades. A new build-time default does not replace a server that was already selected on the device.

Settings that belong to the Android app itself go in `packages/platforms/android-player/src/.env.local`:

| Variable | Purpose |
| --- | --- |
| `VITE_FILE_HOST` | Replaces `localhost` in media URLs before the player downloads them. Use it in development when the server returns `localhost` URLs |
| `VITE_DEBUG_OVERLAY` | Set to `true` to show the [playback debug overlay](on-screen-menu-and-debugging.md#playback-debug-overlay) at startup |

## Build and install

Run these commands from `packages/platforms/android-player`.

Build a debug APK and install it on the connected device:

```bash
yarn android:build
yarn android:install
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. `android:install` replaces an existing installation and starts the player.

Build and install a release APK:

```bash
yarn android:build:prod
yarn android:install:prod
```

The release APK is written to `android/app/build/outputs/apk/release/app-release.apk`.

### Sign a release

Release builds are signed with the key described by these environment variables:

| Variable | Purpose |
| --- | --- |
| `CM_ANDROID_KEYSTORE` | Absolute path to the JKS or PKCS12 keystore |
| `CM_ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `CM_ANDROID_KEY_ALIAS` | Alias of the signing key |
| `CM_ANDROID_KEY_PASSWORD` | Password of the signing key |

```bash
export CM_ANDROID_KEYSTORE="$HOME/.android/castmill-release.jks"
export CM_ANDROID_KEYSTORE_PASSWORD="<keystore-password>"
export CM_ANDROID_KEY_ALIAS="castmill"
export CM_ANDROID_KEY_PASSWORD="<key-password>"

yarn android:build:prod
```

If the variables are not set, Gradle signs the release with the Android debug key. Use such a build for testing only. Keep the keystore and its passwords out of the repository: losing the key prevents you from publishing updates to devices that have the signed app installed.

:::caution
The current build allows cleartext HTTP, mixed content, and WebView debugging to simplify development. Review these settings in `capacitor.config.json` before you deploy to production screens.
:::

## Update the player

Increase `versionCode` and `versionName` in `android/app/build.gradle`, build a new APK, and install it over the existing one. Android only accepts an update signed with the same key as the installed app. Credentials and the cache are kept, so the player does not need to be registered again.

To install on several devices, use `adb -s` with each device's serial number, or distribute the APK with your mobile device management (MDM) system.

## Reset a device

To remove all player data during testing, use Android's **Clear storage** for the app, or run:

```bash
adb shell pm clear com.castmill.android.app
```

This also removes the stored credentials, so the device must be registered again.

## Debugging

Read the player's native log:

```bash
adb logcat -s CastmillPlayer CastmillPlugin WatchdogHelper
```

Restart the player without rebuilding:

```bash
yarn android:restart
```

WebView debugging is enabled in the current build, so you can inspect the running player from `chrome://inspect` in desktop Chrome and use the browser console, for example to turn on the [debug overlay](on-screen-menu-and-debugging.md#playback-debug-overlay).

## Platform notes

- **Local development servers.** On the device, `localhost` means the device itself. Use your computer's LAN address in `VITE_LOCAL_BASE_URL`, make the server listen on a non-loopback interface, and allow the port through your firewall.
- **Changed server URL not used.** Build-time variables are compiled in. Rebuild `@castmill/device` and the APK, reinstall, and select the new server in **Settings** > **Server** or clear the app data.
- **Debug and release builds** are signed with different keys and cannot replace each other. Uninstall the existing app first, which removes its data.
