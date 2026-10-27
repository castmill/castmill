# Castmill Device Package

This package provides a library for implementing Castmill devices for any platform. A device allows playing content
on a given device. The device could be a TV, a tablet, a phone, a desktop computer, Raspberry Pi, etc.

New devices can be added by implementing the `Machine` interface. This interface provides the machine specific methods
that are required by the device to work. You can check the integrations folder for examples on how to implement the
interface for different platforms.

## Device registration

The registration QR code opens the dashboard and carries the pincode through login
to the device registration form. Set `VITE_DASHBOARD_URL` when building the device
package to use a custom dashboard URL (for example, `http://localhost:3000`).
When unset, it uses the current origin.

## Playback orientation

The dashboard device **Details** form saves clockwise orientations of **0, 90,
180, or 270 degrees**. The server persists desired orientation, accepts offline
edits, sends it on every device-channel join/rejoin, and broadcasts live changes.
Players cache their last successfully applied value under the Machine setting
`ORIENTATION`; cached/default orientation is used until the server connects.
Saving is not an application acknowledgement. The Details form shows pending
or error feedback for connected players and next-connection feedback for offline
players; successful application needs no persistent status message.

Dashboard subscriptions request a fresh player acknowledgement on join and when
the player comes online. If a report is missed, online heartbeats retry the
request until a matching applied/error report arrives. Changed preferences and
offline transitions invalidate the subscription's previous confirmation. These
requests reuse the normal orientation apply/report path; already-applied angles
are acknowledged without repeating native rotation or rewriting the cached
setting. No saved preference or online notification is treated as proof of
application.

Deploy the backend orientation migration before enabling the updated dashboard
and players. Existing devices default to 0 degrees; older players remain
identifiable through their missing orientation capability.

`Machine.setOrientation?(orientation)` can return `{ mode: 'native' }` after a
verified native content-rotation operation or `{ mode: 'css' }` for unsupported
native rotation. An absent hook uses CSS. Unexpected native failures reject;
they must not be hidden as successful fallback. Native mode must not also rotate
the DOM. No automatic application restart or display reboot is performed.

`OrientationManager` rotates only the playback subtree, keeping menus and
registration outside it. Its separate wrapper swaps logical width/height for
90/270 degrees without overwriting Renderer viewport clipping or remounting media.
Resizes are observed where supported, with a Chrome 38-compatible fallback.
Player text fitting, pagination, and scrolling use logical dimensions beneath
`data-castmill-orientation`, rather than treating rotated DOM axes as layout axes.
Stopping releases wrapper observers/listeners. Deregistration resets the cached
orientation.

Native WebOS uses `Custom.Configuration.getNativePortraitMode` /
`setNativePortraitMode`, mapping 0 to `"off"` and other angles to degree strings.
Legacy WebOS delegates numeric angles to its embedding player's existing
`setRotation` bridge operation. Native mode rotates the application/display
(including shell UI) and uses the native viewport without extra CSS rotation.
Only a missing native Custom API selects CSS; native/bridge failures and
10-second timeouts are reported as errors. The shared selection/mapping policy
is in `@castmill/webos-player/shared`; do not introduce SCAP globals into it.

## Learn more

- Official website: https://castmill.com/
- Guides: coming soon.
- Docs: coming soon.

## License

This software is open source and is covered by the [AGPLv3 license](./LICENSE.md). If you require a different license for commercial
purposes, please get in touch with us.

## Copyright

(c) 2011-2023 Castmill AB
