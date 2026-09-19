# Castmill webOS Signage Player

The webOS player is the Castmill digital signage client for LG commercial
displays running webOS Signage. It combines:

- a SolidJS and Vite web application;
- the shared `@castmill/device`, `@castmill/player`, and `@castmill/cache`
  packages;
- LG's Signage Control API (SCAP) for storage, power, timers, telemetry,
  application updates, and firmware updates; and
- the current `@webos-tools/cli` commands for IPK packaging, installation, and
  debugging.

This package targets **webOS Signage**, not the consumer LG webOS TV platform.
The application ID is `com.lg.app.signage`, the launcher title is
**Castmill Player**, and the current application version is `2.0.0`.

## Project layout

| Path                           | Purpose                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `src/`                         | SolidJS application and webOS implementations of the Castmill machine and cache interfaces |
| `src/classes/webos-machine.ts` | SCAP-backed device identity, settings, lifecycle actions, updates, timers, and telemetry   |
| `src/classes/file-storage.ts`  | SCAP internal-storage media cache                                                          |
| `src/native/`                  | Typed Promise wrappers around the callback-based SCAP APIs                                 |
| `public/appinfo.json`          | webOS application ID, version, title, icons, orientations, and security settings           |
| `public/lib/`                  | SCAP loader, TypeScript declarations, and locally supplied LG SCAP libraries               |
| `vite.config.ts`               | Legacy Chromium-compatible Vite build configuration                                        |
| `build/`                       | Generated IPK output                                                                       |

## Prerequisites

- Dependencies installed from the monorepo root with `yarn install`
- Node.js and Yarn versions compatible with the root workspace for Vite,
  TypeScript, and tests
- The current `@webos-tools/cli` package
- `ares-package`, `ares-setup-device`, `ares-install`, `ares-launch`,
  `ares-inspect`, `ares-novacom`, and `ares-config` available on `PATH`
- SCAP 1.5 and 1.7 libraries downloaded from LG
- An LG webOS Signage display with development access enabled, or a compatible
  LG webOS Signage emulator

Install the current CLI globally with the same supported Node.js environment
used by the repository:

```bash
npm install --global @webos-tools/cli
```

The CLI requires Node.js 14.15.1 or newer and is tested upstream with Node.js 24. Confirm that the commands resolve to the new package:

```bash
ares-package --version
npm list --global @webos-tools/cli
```

The unified CLI defaults to the consumer TV profile. Select the Signage profile
before configuring displays or deploying the player:

```bash
ares-config --profile signage
ares-config --profile-details
```

The profile is stored by the CLI and remains active for later commands. If you
also develop consumer TV or webOS OSE applications, check the active profile
before deploying this package.

## Install dependencies

Install workspace dependencies from the repository root:

```bash
yarn install
```

The commands in the following sections are run from
`packages/platforms/webos-player` unless stated otherwise:

```bash
cd packages/platforms/webos-player
```

## Install the SCAP API libraries

The SCAP libraries are required on the display but are not distributed in this
repository.

1. Download the SCAP API libraries for versions 1.5 and 1.7 from the
   [LG webOS Signage Developer site](https://webossignage.developer.lge.com/).
2. Extract them into `public/lib/` so the directories have this structure:

   ```text
   public/lib/
   ├── scap_1.5/
   │   ├── cordova/
   │   │   └── 2.7.0/
   │   │       └── cordova.webos.js
   │   └── cordova-cd/
   │       ├── configuration.js
   │       ├── deviceInfo.js
   │       ├── inputSource.js
   │       ├── power.js
   │       ├── security.js
   │       ├── signage.js
   │       ├── sound.js
   │       ├── storage.js
   │       ├── time.js
   │       ├── utility.js
   │       └── video.js
   └── scap_1.7/
       ├── cordova/
       │   └── 2.7.0/
       │       └── cordova.webos.js
       └── cordova-cd/
           ├── configuration.js
           ├── deviceInfo.js
           ├── inputSource.js
           ├── iot.js
           ├── power.js
           ├── security.js
           ├── signage.js
           ├── sound.js
           ├── storage.js
           ├── time.js
           ├── utility.js
           └── video.js
   ```

`public/lib/.gitignore` excludes all `scap_*` directories, so these local
libraries remain available for builds without being committed.

At runtime, `public/lib/scap-loader.js` selects SCAP 1.5 for webOS Signage 3.0
and 3.2. It selects SCAP 1.7 for webOS Signage 4.0 and newer. Keep both
versions in release packages when supporting both display generations.

## Configure the player

### Castmill server URLs

Server settings are Vite environment variables and are embedded in the web
bundle at build time. Copy the tracked template to the ignored local
configuration file, then customize it:

```bash
cp .env.example .env.local
```

```dotenv
VITE_PRODUCTION_BASE_URL=https://api.example.com
VITE_DEV_BASE_URL=https://api.stage.example.com
VITE_LOCAL_BASE_URL=http://192.168.1.10:4000
VITE_DEFAULT_BASE_URL=https://api.example.com
VITE_FILE_HOST=192.168.1.10
```

Files ending in `.local` are ignored by Git. Keep shareable placeholders in
`.env.example`; do not commit local addresses or environment-specific values.

| Variable                   | Purpose                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `VITE_PRODUCTION_BASE_URL` | Adds a **Production** server option to the player                    |
| `VITE_DEV_BASE_URL`        | Adds a **Stage** server option to the player                         |
| `VITE_LOCAL_BASE_URL`      | Adds a **Local** server option for development                       |
| `VITE_DEFAULT_BASE_URL`    | Server used initially when the display has no saved server selection |
| `VITE_FILE_HOST`           | Replaces `localhost` in media URLs before SCAP downloads them        |

Use complete origins without a trailing slash. `VITE_FILE_HOST` is useful when
the Castmill backend returns URLs containing `localhost`: on the display,
`localhost` means the display itself, so use the hostname or LAN IP address of
the development computer instead.

The effective Castmill server URL is selected in this order:

1. The server previously selected in the player's settings
2. `VITE_DEFAULT_BASE_URL`
3. `VITE_DEV_BASE_URL`
4. `VITE_PRODUCTION_BASE_URL`
5. The first configured server option

The player persists its selected server in
`file://internal/castmill-BASE_URL.txt`. Changing a build-time default does not
replace an existing selection. Remove that internal file or clear the
application's data when a test display must return to the build default. This
also requires the display to be registered with Castmill again if all
application data is cleared.

### Application update URL

The player can ask SCAP to download an IPK, install it to local storage, and
reboot the display. Configure the full HTTPS URL of that IPK with
`VITE_UPDATE_URL`:

```bash
VITE_UPDATE_URL=https://updates.example.com/webos/player.ipk yarn build
```

The `yarn build` script supplies this default when the shell variable is not
set:

```text
https://updates.castmill.io/webos/player.ipk
```

Set `VITE_UPDATE_URL` in the shell as shown above when overriding it. The
package script sets its default before Vite loads `.env.local`, so defining
only `VITE_UPDATE_URL` in `.env.local` does not override the default.

By default, `VITE_KEEP_SERVER_SETTINGS` is unset or `false`, so an update writes
the configured URL into the display's SCAP server properties before requesting
the download. Set this when a managed display already has server properties
that the player must preserve:

```dotenv
VITE_KEEP_SERVER_SETTINGS=true
```

With `VITE_KEEP_SERVER_SETTINGS=true`, the update uses the display's existing
SCAP server settings instead of replacing them. Ensure those settings point to
the intended IPK before triggering an update.

### Application metadata

`public/appinfo.json` controls the generated IPK identity and webOS behavior:

| Field                 | Current value        |
| --------------------- | -------------------- |
| `id`                  | `com.lg.app.signage` |
| `version`             | `2.0.0`              |
| `vendor`              | `Castmill AB`        |
| `type`                | `web`                |
| `main`                | `index.html`         |
| `title`               | `Castmill Player`    |
| `inspectable`         | `true`               |
| `crossDomainSecurity` | `disable`            |

Keep the version in `public/appinfo.json` synchronized with the version in
`package.json`. The IPK filename and installed update ordering use the
`appinfo.json` version, while the player reports the `package.json` version in
device information. Increase the version before publishing an update.

`crossDomainSecurity: "disable"` permits the player to contact Castmill and
media origins, and `inspectable: true` permits remote inspection. Both are
development-friendly settings that should be reviewed against the target
fleet's production security requirements.

## Web development

Start the Vite development server on port 3001:

```bash
yarn dev
```

Create or preview a web build with:

```bash
yarn build
yarn serve
```

A desktop browser does not provide SCAP. It can be used for limited web UI
work, but storage, power, timers, telemetry, application updates, and other
native behavior must be tested on a Signage display or compatible emulator.

The Vite build targets Chrome 38 and emits legacy polyfills because older webOS
Signage generations use old Chromium versions. Do not remove this compatibility
configuration without testing every supported display generation.

## Build the web application

Build the application with the repository's normal Node.js version:

```bash
yarn build
```

Vite writes the application to `dist/` and copies `public/appinfo.json`, icons,
the SCAP loader, and the locally installed SCAP libraries into that directory.
Confirm that both SCAP directories are present before packaging:

```bash
test -d dist/lib/scap_1.5
test -d dist/lib/scap_1.7
```

## Package an IPK

After building `dist/`, package it with:

```bash
yarn package
```

The script runs the current `ares-package` directly, disables a second
minification pass, excludes generated test files, and writes the IPK to
`build/`.

With the current metadata, the output is:

```text
build/com.lg.app.signage_2.0.0_all.ipk
```

The complete unsigned build flow is:

```bash
yarn build
yarn package
```

## Configure a target display

Development access differs by webOS Signage model and firmware. Enable the
display's development or debugging access using LG's instructions, place the
computer and display on reachable networks, and note the display's IP address,
SSH port, username, and authentication method.

Add a named target to the LG CLI:

```bash
ares-setup-device \
  --add castmill-display \
  --info "host=<display-ip>" \
  --info "port=9922" \
  --info "username=prisoner"
```

Port `9922` and user `prisoner` are the Signage profile defaults. Change them
only when the target display is configured differently. Add `password` or
`privatekey` settings when required by the display. Do not put reusable
credentials in this repository.

List and inspect configured targets:

```bash
ares-setup-device --listfull
```

If the display uses LG's Secure Developer Mode key server, enable its key
server and retrieve the SSH key:

```bash
ares-novacom --getkey --device castmill-display
```

## Install, launch, and debug

Install the generated IPK:

```bash
ares-install \
  build/com.lg.app.signage_2.0.0_all.ipk \
  --device castmill-display
```

Launch or close the player:

```bash
ares-launch com.lg.app.signage --device castmill-display

ares-launch --close com.lg.app.signage --device castmill-display
```

Because `inspectable` is enabled, obtain a remote Web Inspector URL with:

```bash
ares-inspect com.lg.app.signage --device castmill-display
```

Pass `--open` to ask the CLI to open the inspector URL in a browser.

Useful target checks are:

```bash
ares-install --list --device castmill-display

ares-launch --running --device castmill-display
```

## Runtime behavior

On first launch, the shared device application connects to the configured
Castmill server and guides the user through display registration. The webOS
integration:

- derives a stable machine identifier from the wired or Wi-Fi MAC address;
- stores credentials, selected server, and timer state in SCAP internal
  storage;
- caches downloaded media under `file://internal/castmill-cache/`;
- reports model, firmware, Chromium, storage, temperature, fan, and network
  telemetry when supported by the display;
- restarts the application and reboots or powers off the display through SCAP;
- configures on/off timers using the API available on the display's SCAP
  version;
- downloads and installs player updates from `VITE_UPDATE_URL`; and
- downloads model-specific firmware from the Castmill firmware update service.

Some telemetry and timer APIs do not exist on every SCAP version. The
integration detects optional timer methods and treats unsupported telemetry as
unavailable rather than requiring every display generation to expose the same
capabilities.

## Sign an IPK

The current `yarn package` command creates an **unsigned** IPK. No official
Castmill webOS private key, certificate, or signing automation is included in
this repository.

The current `@webos-tools/cli` packager supports signing with a PEM private key
and certificate. These options are available in version 3.2.5 even though they
are omitted from its abbreviated `ares-package --help` output:

```bash
ares-package \
  --no-minify \
  --outdir build \
  --app-exclude "*.test.js" \
  --sign /absolute/path/to/private-key.pem \
  --certificate /absolute/path/to/certificate.crt \
  dist
```

The private key and certificate options must be supplied together. The
packager signs the application payload with SHA-256 and includes the
certificate in the IPK.

### Generate a local test key and certificate

To exercise packaging locally, create a self-signed test identity outside the
repository:

```bash
mkdir -p "$HOME/.webos-signing"

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$HOME/.webos-signing/castmill-local.pem" \
  -out "$HOME/.webos-signing/castmill-local.crt" \
  -days 3650 \
  -subj "/CN=Castmill Local webOS Test/"
```

Then use those two files with `ares-package --sign` and
`--certificate`. A self-signed package is only for validating the local build
flow; acceptance depends on the target display's firmware and provisioning.
Do not treat it as an official release identity.

For a future production pipeline, obtain a certificate trusted by the target
LG Signage fleet or required LG distribution process. Keep its private key in
restricted secret storage, inject it only into the packaging job, and maintain
an encrypted backup. Never commit private keys or certificates containing
private material.

## Host an IPK for SCAP updates

The URL embedded as `VITE_UPDATE_URL` must remain reachable by the display and
return the complete IPK. Use HTTPS with a certificate trusted by the display.
The published filename can remain stable, such as `player.ipk`, while the
version inside `appinfo.json` increases for each release.

Before triggering a remote update, verify:

- the IPK was built from the intended commit and environment;
- `package.json` and `public/appinfo.json` have the same version;
- the published URL downloads the new IPK without authentication redirects;
- the display trusts the HTTPS certificate;
- the package uses the expected signing identity, when signing is required;
  and
- rollback artifacts remain available for the target display generation.

## Tests and quality checks

Run the TypeScript tests and checks from this package:

```bash
yarn test
yarn lint
yarn format:check
```

These tests mock SCAP behavior. Validate native storage, timers, telemetry,
power, installation, and update behavior on representative physical displays
before releasing.

## Troubleshooting

### The CLI uses the wrong platform profile

The unified CLI defaults to the consumer TV profile. Select and verify the
Signage profile:

```bash
ares-config --profile signage
ares-config --profile-details
```

### `ares-package` or another `ares-*` command resolves to an old SDK

Confirm the active command and version, then remove the old SDK's CLI directory
from `PATH`:

```bash
command -v ares-package
ares-package --version
npm list --global @webos-tools/cli
```

The packaging script expects the current globally installed
`@webos-tools/cli` on the active Node.js runtime.

### SCAP constructors or APIs are missing

Confirm the required files exist under `public/lib/scap_1.5` and
`public/lib/scap_1.7`, rebuild, and inspect the same directories in `dist/lib`.
Use Web Inspector console logs to confirm which webOS and SCAP version the
loader selected.

### The CLI cannot connect to a display

Verify development access is still enabled, the configured IP address and SSH
port match the display, and the host can reach that port. Refresh the Secure
Developer Mode key with `ares-novacom --getkey` when that mode is in use.

### The display cannot reach a local Castmill server

Use the development computer's LAN address rather than `localhost`, ensure the
server listens on a non-loopback interface, and allow the port through the host
firewall. Configure `VITE_LOCAL_BASE_URL` and, when returned media URLs contain
`localhost`, `VITE_FILE_HOST`.

### A changed Castmill server URL is not being used

Vite variables are embedded at build time, so rebuild, repackage, and reinstall
the IPK. If the display previously selected another server, remove its saved
setting or clear the application's internal data.

### An update downloads the wrong package

Confirm the build-time `VITE_UPDATE_URL`, the display's current SCAP server
properties, and `VITE_KEEP_SERVER_SETTINGS`. When that variable is `true`, the
player deliberately preserves the display's existing update server settings.

### The installed version does not change

Increase `version` in both `public/appinfo.json` and `package.json`, rebuild the
web application, and create a new IPK. Check the installed applications with
`ares-install --list`.
