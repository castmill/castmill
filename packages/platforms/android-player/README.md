# Android Player

This package contains the Castmill Android player built with Vite + Capacitor.

## Prerequisites

- Android SDK and platform tools installed
- A connected Android device (USB or wireless adb)
- Dependencies installed from the workspace root (`yarn install`)

## Build, Install, and Start

From this folder, run:

```bash
yarn android:build
```

This command:

1. Builds web assets with Vite
2. Runs `npx cap sync`
3. Builds the debug APK with Gradle

Then install and launch the app on your connected device:

```bash
yarn android:install
```

`android:install` installs the debug APK and immediately starts the app.

## Restart the App over adb

If the app is already installed and you only want to restart it:

```bash
yarn android:restart
```

This force-stops the app and launches it again over adb.

## Dev Web Build Only

For web-only local development:

```bash
yarn start
```
