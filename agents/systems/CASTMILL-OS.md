# Castmill OS platform

[Castmill OS](https://github.com/castmill/castmill-os) is an immutable Linux
distribution for Castmill players (Intel mini PCs, Raspberry Pi 5). It is a
Castmill platform like `packages/platforms/*`, but it does not bundle the
device app: its kiosk shell loads the backend-hosted web player (`GET /`,
`packages/castmill/assets/js/device.js`) and gives it native OS access through
a bridge.

## How the device app detects it

The Castmill OS kiosk shell (Electron) exposes `window.castmillOS` to the main
frame of the backend origin:

```ts
interface CastmillOSBridge {
  readonly version: number; // 1
  call(method: string, ...args: unknown[]): Promise<unknown>;
}
```

`device.js` calls `getCastmillOSBridge()` and, when it finds a bridge, uses
`CastmillOSMachine` (`packages/device/src/integrations/castmill-os.ts`)
instead of `BrowserMachine`. Everything else (registration with pincode,
`devices:<id>` channel, commands, telemetry, cache, schedules) is the normal
device flow.

## Machine methods

| Method | Answered by (on the device) |
|---|---|
| `getSetting` / `setSetting`, `storeCredentials` / `getCredentials` / `removeCredentials` | kiosk shell, files on the data partition |
| `getMachineGUID` | castmill-agent: random ID kept until a factory reset, plus the output name |
| `getDeviceInfo` | castmill-agent + kiosk shell (`appType: "Castmill OS"`, OS version, hardware, Electron/Chromium versions) |
| `getHardwareInfo` (merged into `getDeviceInfo`) | castmill-agent + kiosk shell: `cpu`, `memory`, `gpu`, `graphicsAcceleration` (`hardware`/`software`), `videoDecoding` (formats decoded in hardware), `display` (output and mode). Missing on Castmill OS 0.1, so `CastmillOSMachine` ignores errors and keeps only known, well-typed fields |
| `getTelemetry` | castmill-agent, already in `TelemetryData` shape |
| `getTimezone`, `reboot` | castmill-agent |
| `restart`, `clearCache` | kiosk shell |

Not implemented on purpose: `shutdown`, `update` (the shell is part of the OS
image), `updateFirmware` (until the backend manages OS versions) and
`setOrientation` (the device uses CSS rotation). Capabilities follow from this.

## OS updates

Castmill decides which Castmill OS version each device runs
(castmill-os ADR-0010, `Castmill.OsUpdates`):

- `Castmill.OsUpdates.Importer` imports releases hourly from the GitHub
  releases of `castmill/castmill-os` (`manifest.json` per release: bundle URL,
  SHA-256 and size per RAUC compatible). Configure with
  `config :castmill, Castmill.OsUpdates, github_repo: ..., import_interval: ...`.
- Organization policy (`organizations.os_update`): `manual` (default),
  `latest` (pre-releases only if enabled) or `version`. Device override
  (`devices.os_update`): `follow` or `version`, optionally `now`.
- On join (and when the target changes) the device channel pushes
  `os_update` with `{version, url, sha256, size, security, activate,
  override}` or `{version: nil}`. The device app passes it to
  `CastmillOSMachine.setOsUpdate`.
- The device app reports `getOsUpdateStatus` with `os_update:report` after
  login and whenever it changes; it is stored in `devices.os_status` and
  pushed to open dashboards. The first report tells the backend the
  device's hardware family (`compatible`), so the target follows it.
- Dashboard: "Castmill OS" tab on the device page
  (`device-os-update.tsx`); endpoints `GET/PUT
  /dashboard/organizations/:id/os-updates` and `PUT
  /dashboard/devices/:id/os-update` (devices: show / update).

## Things to know when changing the device app

- Each output (screen) of a Castmill OS device is a separate Castmill device
  with its own credentials and machine GUID.
- The bridge only answers the top-level page of the origin the device loaded,
  so device code that calls the machine from an iframe won't work there.
- Keep `CastmillOSMachine` backwards compatible: devices in the field run the
  bridge version of their OS image, while the device app updates with the
  backend. New methods must be optional and feature-detected.
- `POST /devices/:id/info` rejects unknown keys. New device info fields go
  through a separate bridge method that only a device app knowing them
  calls (like `getHardwareInfo`), never into `getDeviceInfo` itself, or older
  servers would reject the whole update.

## Planned backend work

OS updates managed from Castmill: a release registry (version, compatible
hardware, bundle URL, security flag), a desired OS version per device or group
with channels and staged rollouts, and update status reported over the device
channel. See the Castmill OS
[integration document](https://github.com/castmill/castmill-os/blob/main/docs/castmill-integration.md#os-updates).
