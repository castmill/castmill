---
sidebar_position: 9
title: Troubleshooting players
description: Diagnose and fix common problems with Castmill players, from registration to playback, orientation, and scheduling.
---

# Troubleshooting players

Start with the device's **Events** tab in the dashboard. Most player problems are reported there. The [on-screen menu](on-screen-menu-and-debugging.md) shows which server, organization, and device the player uses, and the [debug overlay](on-screen-menu-and-debugging.md#playback-debug-overlay) shows what it is playing.

## The pincode is not shown or has expired

The player shows a progress screen until it receives a pincode from the server. If it stays on that screen, it cannot reach the server.

Check the following:

1. The screen has a network connection and can resolve and reach the server's hostname over HTTPS.
2. The player uses the right server. Open the on-screen menu and check **Settings** > **Server**. Installed players use the server addresses compiled into them; see the platform pages.
3. The server's certificate is valid and trusted by the device. Old devices may not trust newer certificate authorities.
4. The screen's clock is correct. A wrong date can make valid certificates appear invalid.

If registration fails because the pincode has expired, restart the player. Pincodes expire one hour after the player requested them, and the player does not request a new one until it restarts. Use **Restart App** in the on-screen menu or power-cycle the screen, then enter the new pincode.

If the dashboard rejects a valid pincode, check that you are registering the device in the intended organization and that the organization has not reached its device quota. **Add Device** is disabled when the quota is reached.

If the QR code opens the wrong address, type the pincode in the dashboard instead. The QR code opens the dashboard address compiled into the player.

## The screen shows "Automatic recovery is blocked"

The player lost its credentials and requested a new pincode, and the server recognized it as an existing device but could not confirm that it is the same device because its IP address changed.

Open the device in the dashboard, select the **Maintenance** tab, and enable **Recover lost settings**. The screen checks again automatically and reconnects with its existing registration.

## The device is offline

The dashboard shows a device as offline when its WebSocket connection is closed. An offline player continues to play cached content.

Check the following:

1. The screen is switched on and the player is running. Check the device's **Schedule** tab: the screen may be off on purpose.
2. The device has a network connection and can reach the server. See [Network requirements](overview.md#network-requirements).
3. Proxies, firewalls, and load balancers allow WebSocket connections to `/socket` on the server. If the player shows content but the device stays offline, this is the most likely cause.
4. The **Events** tab shows when the device went offline. Repeated **Online** and **Offline** events point to an unstable connection.

The player retries the connection with an increasing delay of up to 60 seconds, so a device can take up to a minute to appear online after the network returns. Native webOS players also reset their network adapters after two failed connectivity checks, 10 minutes apart.

## Black screen or video does not play on old hardware

Check the following:

1. The device has channels assigned and the channel has content scheduled for the current time, or a default playlist. A device without scheduled content shows nothing.
2. The **Events** tab has no `media-load` or `playback` errors. They show which media failed.
3. Media URLs are reachable from the screen. URLs containing `localhost` or a container hostname fail on the device. Set `MEDIA_PUBLIC_BASE_URL` on the server and reprocess the affected media. See [Configuration](../administration/configuration.md).
4. On webOS, the layout does not play more than two videos at the same time. A `video-decoder-limit` event means videos were delayed or skipped. Reduce the number of video areas, or combine videos into one.
5. The video format, codec, and resolution are supported by the device. Check the manufacturer's specifications, and test with a short H.264 MP4 file to rule out the media itself.
6. Custom widgets and web content work in Chrome 38 if the screen runs an old engine, such as legacy Android players and webOS Signage 3.x displays. See [Legacy players](legacy-players.md#compatibility-constraints).

Turn on the [debug overlay](on-screen-menu-and-debugging.md#playback-debug-overlay) to see whether the player believes it is playing an item while the screen stays black. If so, the problem is in the media or the device's decoder. Media events alone do not prove that frames are visible, so watch the screen.

## The orientation is wrong

Set the orientation on the device's **Overview** tab under **Settings** > **Orientation**. Angles are clockwise: 0, 90, 180, or 270 degrees. See [Devices](../dashboard/devices.md).

Check the following:

1. The status shown with the field. No status means the player confirmed the orientation. **Orientation saved. Waiting for the player to confirm.** means the player has not confirmed it yet. **Saved orientation applies when the player next connects.** means the device is offline. **Update this player to enable orientation settings.** means the player is too old.
2. **The player could not apply this orientation. Check device events.** means the player reported an error. Open the error on the **Events** tab for details.
3. The screen is not rotated twice. If the operating system, the display's own settings, or the mounting already rotate the picture, set the Castmill orientation accordingly. On computers running the browser or Electron player, either rotate the desktop in the operating system or use the Castmill orientation, not both.

Native webOS rotation changes the whole display, including the on-screen menu. On other platforms, only the playback area is rotated.

## Content is not updating

Check the following:

1. The device is online. Offline players play cached content until they reconnect.
2. The changed content is in a playlist that is scheduled on a channel assigned to the device, at the current time.
3. The player has reached the next round of its schedule. A playlist that is already queued keeps playing until it finishes. When several channels are assigned, the player alternates between them, so a change on one channel appears when that channel's turn comes.
4. If a replaced media file still shows the old version, delete the entry on the device's **Cache** tab or run **Clear Cache** on the **Maintenance** tab.
5. Run **Refresh** on the **Maintenance** tab to reload the player without clearing its cache.

## The schedule plays at the wrong time

Channel schedules are stored as absolute times and compared with the device's clock. The power schedule uses the device's local time.

Check the following:

1. The device's date and time are correct, and network time (NTP) is enabled. A device clock that is off by an hour plays the schedule an hour early or late.
2. The channel's time zone is set correctly in the dashboard. See [Channels](../dashboard/channels.md).
3. The device's own time zone matches its location, so that power schedule on and off times are applied at the expected local time. On webOS, set the time zone in the display's settings.
4. The on-screen menu's **Status** entry shows the next on or off time the player has calculated.

## Report a problem

When you report an issue, include:

- the platform, application version, and operating system shown in the on-screen menu header;
- the device ID from the menu footer or the dashboard;
- the related events from the **Events** tab, including their details;
- a photo or video of the screen if the problem is visual.
