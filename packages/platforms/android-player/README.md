# Castmill Android Player

The Android player is the Castmill digital signage client for Android devices.
It combines:

- a SolidJS and Vite web application;
- the shared `@castmill/device`, `@castmill/player`, and `@castmill/cache`
  packages;
- Capacitor, which packages the web application in an Android WebView; and
- native Java integrations for application restart, device reboot, launch on
  boot, and watchdog communication.

The application ID is `com.castmill.android.app` and the launcher name is
**Castmill Player**. The current Android project supports Android 5.1 and newer
(`minSdkVersion 22`) and targets Android API 34.

## Project layout

| Path                                                  | Purpose                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/`                                                | SolidJS application and Android implementations of the Castmill machine and cache interfaces |
| `src/ts/classes/android-machine.ts`                   | Device identity, settings, telemetry, and native lifecycle actions                           |
| `src/ts/classes/android-storage.ts`                   | Capacitor Filesystem-backed media cache                                                      |
| `src/plugins/castmill/`                               | TypeScript interface for the custom native plugin                                            |
| `android/`                                            | Capacitor-generated Android/Gradle project plus Castmill native Java code                    |
| `android/app/src/main/java/com/castmill/android/app/` | Main activity, boot receiver, watchdog helper, root tools, and native plugin                 |
| `capacitor.config.json`                               | Capacitor application and WebView configuration                                              |
| `vite.config.ts`                                      | Web build configuration; generated assets are written to `dist/`                             |

## Prerequisites

- Dependencies installed from the monorepo root with `yarn install`
- Node.js and Yarn versions compatible with the root workspace
- JDK 17
- Android Studio or the Android command-line tools
- Android SDK Platform 34 and matching build tools
- `adb` on `PATH` for command-line installation and debugging
- A physical Android device with USB or wireless debugging enabled, or an
  Android emulator

Set `ANDROID_HOME` or `ANDROID_SDK_ROOT` if the Android SDK is not discovered
automatically. You can confirm the main tools are available with:

```bash
java -version
adb version
```

## Install dependencies

Install workspace dependencies from the repository root:

```bash
yarn install
```

The commands in the following sections are run from
`packages/platforms/android-player` unless stated otherwise:

```bash
cd packages/platforms/android-player
```

## Configure the player

### Castmill server URLs

Server settings are Vite environment variables, so they are embedded in the
web bundle at build time. Set them in the shell that runs Vite, or place them
in `src/.env.local`. The `src/` location is significant because it is the Vite
project root. Files ending in `.local` are ignored by Git.

```dotenv
VITE_PRODUCTION_BASE_URL=https://api.example.com
VITE_DEV_BASE_URL=https://api.stage.example.com
VITE_LOCAL_BASE_URL=http://192.168.1.10:4000
VITE_DEFAULT_BASE_URL=https://api.example.com
VITE_FILE_HOST=192.168.1.10
```

| Variable                   | Purpose                                                                    |
| -------------------------- | -------------------------------------------------------------------------- |
| `VITE_PRODUCTION_BASE_URL` | Adds a **Production** server option to the player                          |
| `VITE_DEV_BASE_URL`        | Adds a **Stage** server option to the player                               |
| `VITE_LOCAL_BASE_URL`      | Adds a **Local** server option for development                             |
| `VITE_DEFAULT_BASE_URL`    | Server used initially when the device has no saved server selection        |
| `VITE_FILE_HOST`           | Replaces `localhost` in media URLs before the Android cache downloads them |

Use complete origins without a trailing slash. `VITE_FILE_HOST` is useful when
the Castmill backend returns URLs containing `localhost`: on an Android device,
`localhost` means the device itself, so this value should be the hostname or
LAN IP address of the development computer.

The effective server URL is selected in this order:

1. The server previously selected in the player's settings
2. `VITE_DEFAULT_BASE_URL`
3. `VITE_DEV_BASE_URL`
4. `VITE_PRODUCTION_BASE_URL`
5. The first configured server option

The selected URL is persisted with Capacitor Preferences and survives
application restarts and upgrades. Changing a build-time default does not
replace an existing selection. To reset all application data during
development, use Android's **Clear storage** action or:

```bash
adb shell pm clear com.castmill.android.app
```

This also removes the device's stored Castmill credentials and requires it to
be registered again.

### Capacitor and Android settings

The main package settings are split between these files:

- `capacitor.config.json`: application ID/name, web output directory, splash
  screen, mixed-content behavior, and WebView debugging;
- `android/variables.gradle`: minimum, compile, and target Android SDK versions;
- `android/app/build.gradle`: application version, dependencies, build types,
  and signing; and
- `android/app/src/main/AndroidManifest.xml`: permissions, launcher activity,
  file provider, and boot receiver.

The current Capacitor configuration permits cleartext traffic and mixed
content and enables WebView debugging. These settings support local signage
development but should be reviewed before an official production release.

Update both `versionCode` and `versionName` in
`android/app/build.gradle` before publishing a new release. Android requires
each published update to have a higher `versionCode`.

## Web development

Start the Vite development server:

```bash
yarn start
```

This runs only the web application. Capacitor-only APIs are unavailable or may
have browser fallbacks. To inspect a build locally:

```bash
yarn build
yarn preview
```

## Build an Android APK

Build the web assets, synchronize them and the Capacitor plugins into the
Android project, and create a debug APK:

```bash
yarn android:build
```

This is equivalent to:

```bash
yarn build
npx cap sync
cd android
./gradlew assembleDebug
```

The APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

To work in Android Studio, build and synchronize first, then open the native
project:

```bash
yarn build
npx cap sync android
npx cap open android
```

Run `npx cap sync android` again whenever web assets, Capacitor dependencies, or
native plugin configuration changes.

## Install and run on a device

Confirm that Android can see the target:

```bash
adb devices
```

Build, install, and launch a debug APK:

```bash
yarn android:build
yarn android:install
```

`android:install` replaces an existing debug installation and launches the
main activity. To restart an already installed application without rebuilding:

```bash
yarn android:restart
```

When more than one device is connected, use `adb -s <serial>` with the
underlying install and launch commands, or select the target in Android Studio.

Useful debugging commands are:

```bash
adb logcat -s CastmillPlayer CastmillPlugin WatchdogHelper
adb shell am force-stop com.castmill.android.app
adb shell monkey -p com.castmill.android.app \
  -c android.intent.category.LAUNCHER 1
```

Because WebView debugging is currently enabled, the running application can
also be inspected from `chrome://inspect` in desktop Chrome.

## Runtime behavior and device requirements

On first launch, the shared device application connects to the configured
Castmill server and guides the user through device registration. Credentials,
the selected server, and other player settings are stored with Capacitor
Preferences. Downloaded media is cached with Capacitor Filesystem.

The Android integration also:

- receives `BOOT_COMPLETED` and starts the player after the device boots;
- collects Android device, storage, memory, battery, and network telemetry;
- attempts to launch and enable a separate Castmill watchdog application; and
- exposes restart, quit, and reboot actions to the shared device package.

The watchdog application is not included in this package. The player still
starts without it, but logs watchdog errors and cannot rely on the watchdog to
recover from a stopped process.

Restart and reboot use root commands. They are intended for managed or rooted
signage hardware and are not expected to work on a standard, unprivileged
Android device. Shutdown and in-app application updates are currently
placeholders.

## Build a release

Create a release APK with:

```bash
yarn android:build:prod
```

Install and launch it with:

```bash
yarn android:install:prod
```

The expected APK path is:

```text
android/app/build/outputs/apk/release/app-release.apk
```

There is currently no official Castmill release keystore or automated Android
publishing pipeline in this repository. If release signing variables are not
provided, Gradle signs the release build with the Android debug key so it can
be installed for testing. A debug-signed release must not be distributed as an
official production build.

### Generate a local signing key

To exercise the release-signing flow locally, generate a private test keystore
outside the repository:

```bash
keytool -genkeypair -v \
  -keystore "$HOME/.android/castmill-local-release.jks" \
  -alias castmill-local \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Do not use this local test key for an official release.

### Sign a release with Gradle

`android/app/build.gradle` reads these environment variables:

| Variable                       | Purpose                                     |
| ------------------------------ | ------------------------------------------- |
| `CM_ANDROID_KEYSTORE`          | Absolute path to the JKS or PKCS12 keystore |
| `CM_ANDROID_KEYSTORE_PASSWORD` | Keystore password                           |
| `CM_ANDROID_KEY_ALIAS`         | Alias of the signing key                    |
| `CM_ANDROID_KEY_PASSWORD`      | Password for the signing key                |

Set all four variables before building:

```bash
export CM_ANDROID_KEYSTORE="$HOME/.android/castmill-local-release.jks"
export CM_ANDROID_KEYSTORE_PASSWORD="<keystore-password>"
export CM_ANDROID_KEY_ALIAS="castmill-local"
export CM_ANDROID_KEY_PASSWORD="<key-password>"

yarn android:build:prod
```

Never commit a keystore or its passwords. For a future official release
pipeline, keep the keystore in restricted secret storage, inject the passwords
through CI secrets, limit access, and maintain an encrypted backup. Losing the
production signing key prevents publishing updates signed with the same
identity.

Verify the resulting APK and inspect its certificate with the Android SDK
`apksigner` tool:

```bash
apksigner verify --verbose --print-certs \
  android/app/build/outputs/apk/release/app-release.apk
```

### Build an Android App Bundle

An official store release will normally use an Android App Bundle. There is no
package script for it yet, but Gradle can build one after the web application
has been synchronized:

```bash
yarn build
npx cap sync android
cd android
./gradlew bundleRelease
```

With the four signing variables set, the bundle is signed by the configured
key and written to:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

## Tests and quality checks

Run the TypeScript tests and checks from this package:

```bash
yarn test
yarn lint
yarn format:check
```

Run the native Java unit tests after synchronizing Capacitor:

```bash
yarn build
npx cap sync android
cd android
./gradlew test
```

## Troubleshooting

### Android SDK location is missing

Set `ANDROID_HOME` or `ANDROID_SDK_ROOT`, or open the `android/` directory in
Android Studio and let it configure the local SDK path.

### `adb` reports no devices

Enable developer options and USB debugging, accept the authorization dialog on
the device, and run `adb devices` again. For a physical device, also verify the
USB mode and vendor driver where applicable.

### The device cannot reach a local Castmill server

Use the development computer's LAN address rather than `localhost`, ensure the
server listens on a non-loopback interface, and allow the port through the host
firewall. Configure `VITE_LOCAL_BASE_URL` and, when returned media URLs contain
`localhost`, `VITE_FILE_HOST`.

### A changed URL is not being used

Vite variables are embedded at build time, so rebuild and reinstall the APK.
If the device previously selected another server, clear the selection in the
player or clear the application data.

### Release and debug APKs cannot replace each other

Android only permits an update when the installed application and replacement
APK use compatible signing certificates. Uninstall the existing development
application, which clears its data, or sign both builds with the same key.

### Native changes are not present

Run `npx cap sync android`, rebuild the APK, and reinstall it. For Java-only
changes, a Gradle rebuild is still required even if the web bundle is
unchanged.
