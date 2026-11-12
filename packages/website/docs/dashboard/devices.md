---
sidebar_position: 8
title: Devices
description: Register screens, assign channels, set orientation and power schedules, and monitor and maintain your players.
---

# Devices

A device is a screen running a Castmill player, registered to your organization. From **Devices** in the sidebar you register new screens, choose what they play, and check and maintain them remotely.

For installing and running players on specific hardware (browser, Android, LG webOS, Electron and legacy players), see [Players](/docs/players/overview).

## Registering a device

When a player starts and is not registered yet, it shows a 10-character pincode on the screen.

1. Start the player on the screen and note the pincode.
2. In the dashboard, open **Devices** and click **Add Device**.
3. In the **Register device** dialog, enter a **Name** for the screen and the **Pincode**.
4. Click **Register**.

The player receives its credentials, reloads and starts playing. Use **Register Another** to add the next screen.

A pincode expires one hour after the player showed it. If registration fails with "This pincode has expired", restart the player to get a new pincode.

When you register a device through the dashboard, Castmill also creates a channel named "*device name* Default". Its default playlist, with the same name, contains the Intro widget, so the new screen shows something right away. Replace or edit this channel when you are ready. Registering a device needs the Administrator, Manager or Device manager role.

:::tip
To try Castmill without hardware, open the browser player in another window. It shows a pincode like any other player. See [Your first screen](../getting-started/first-screen.md).
:::

## The device list

The list shows each device's **Name**, whether it is **Online**, its **Timezone**, player **Version**, last **IP Address** and **Tags**. Search, the **Team** and **Tags** filters and the tree view work as on other resource pages. A quota indicator shows how many devices your plan allows.

### Online and offline

A device is **Online** while its player is connected to the server. Commands, live telemetry, the cache view and immediate settings changes need an online device. Changes you make while a device is offline, such as channels, orientation or the power schedule, are stored and reach the player when it reconnects.

Players keep playing their downloaded content while offline. See [Offline playback and caching](/docs/players/offline-and-caching).

## Device details

Click a device to open its details. The header shows when the device was last seen and a button to copy the device ID. The details have these sections:

| Section | What you do there |
| --- | --- |
| **Overview** | Edit name, description and orientation; read device information |
| **Channels** | Choose the channels the device plays |
| **Schedule** | Set when the screen is on |
| **Automations** | See the automations the device runs and their next firings |
| **Preview** | See what the device should be playing now |
| **Telemetry** | Read live health data |
| **Events** | Read connection changes and errors |
| **Cache** | Inspect and clear the files stored on the player |
| **Maintenance** | Send commands such as refresh or restart |

### Overview

**Settings** contains the **Name**, the **Description** (both at least 5 characters) and the [orientation](#orientation). Click **Save** to store changes, or **Reset** to undo them.

**Info** shows what the player reports: **Platform**, **Player version**, **Operating system**, **Hardware**, **Timezone**, **IP Address**, runtime versions (environment, Chromium, V8, Node.js), the **User agent**, and when the device was added and last updated.

## Orientation

Orientation rotates the content clockwise from the screen's normal position. Use it when a screen is mounted in portrait or upside down.

| Option | Rotation |
| --- | --- |
| **Landscape** | 0° |
| **Portrait** | 90° clockwise |
| **Landscape (flipped)** | 180° |
| **Portrait (flipped)** | 270° clockwise |

To change it:

1. Open the device and go to **Overview**.
2. Next to **Orientation**, click **Change** and choose an option, then click **Done**.
3. Click **Save**.

Saving stores the orientation on the server. It is not a confirmation that the screen has rotated. The status under the setting tells you what happened:

| Status | Meaning |
| --- | --- |
| **Saved orientation applies when the player next connects.** | The device is offline. You can still save; the player applies the orientation when it reconnects. |
| **Orientation saved. Waiting for the player to confirm.** | The player has not reported the new orientation yet. |
| No message | The player has applied the saved orientation. |
| **The player could not apply this orientation. Check device events.** | The player reported an error. See **Events**. |
| **Update this player to enable orientation settings.** | The player version does not support orientation. Update the player. |

Depending on the platform, the player rotates the screen output natively or rotates the content in software. Design playlists for the rotated shape, for example 9:16 for **Portrait**. See [Players](/docs/players/overview) for platform details.

## Channels

The **Channels** section lists the channels the device plays. Use **Add Channel** to add one and the remove button to remove one.

A device with several channels plays them in turn: the current playlist of the first channel, then the current playlist of the second channel, and so on, then back to the first. A channel with nothing to play at that moment is skipped. Each channel decides its current playlist by its own calendar and timezone. See [Channels](./channels.md).

A device always has at least one channel. You cannot remove its last channel; add another one first.

## Schedule

The **Schedule** section, **Device Schedule**, defines when the screen is on. Outside the scheduled hours the device turns off. If there are no entries, the device is always on.

1. Drag on the weekly grid to create an "on" period, or tap an empty slot.
2. Click an entry to edit its **Start day**, **End day**, **Start time** and **End time**. Set the end time to 00:00 to stay on until midnight. Entries cannot overlap.
3. Click **Save Schedule**.

The schedule is sent to the device right away, or when it reconnects if it is offline. Players that can control the display hardware use its on/off timers. Other players use a software fallback: they stop playback outside the scheduled hours.

## Automations

The **Automations** section lists the automations this device runs, whether **Assigned directly** or **Via channel**, with their **Upcoming firings** in the device's timezone. You create and assign automations on the Automations page. See [Automations](./automations.md).

## Preview

**Preview** shows what the device should be playing now according to its channel schedules, and from which channel. It is computed by the dashboard, so it can differ from what the screen actually displays, for example while the device is offline.

## Telemetry

**Telemetry** shows live health readings reported by the player, when the platform supports them: storage, memory, CPU usage and load, network connection and WiFi signal, temperature, fan speed, battery and uptime. Use **Refresh telemetry** to read them again. Telemetry is available only while the device is online.

## Events

**Events** lists connection changes and errors reported by the player. Filter by **Errors**, **Warnings**, **Info**, **Online** and **Offline**. Repeated errors are grouped, with the number of **Occurrences** and when they were first and last seen; **Details** shows sanitized diagnostic details. **Clear All Events** deletes the device's events.

## Cache

**Cache** lists the files the player stores locally so it can keep playing offline, in the tabs **Data**, **Code** and **Media**. You can delete single entries, **Delete selected items** or **Clear Entire Cache**. Clearing the whole cache makes the player reload and download everything again. The cache is visible only while the device is online.

## Maintenance

**Maintenance** sends commands to an online device. Commands that the player does not support show **Not supported.**

| Group | Command | What it does |
| --- | --- | --- |
| **Playback** | **Refresh** | Reloads the player. Use it when the device runs but behaves oddly. |
| | **Clear Cache** | Clears the cache and downloads all content again. |
| | **Restart App** | Restarts the player application. |
| **System** | **Check for updates** | Checks for player updates and installs them, without restarting the device. |
| | **Restart Device** | Turns the device fully off and on again. |
| | **Update Firmware** | Updates the device firmware. |

The player shows a short message on the screen, such as "Rebooting", before it runs a command.

The dashboard has no command to quit the player or shut the device down. On players that support them, those actions are available in the on-screen menu. See [On-screen menu and debugging](/docs/players/on-screen-menu-and-debugging).

### Recover lost settings

If a player loses its stored credentials, it can recover them automatically, but only when it connects from the same IP address as before. **Recover lost settings** lets it reconnect from a different IP address as well. Choose **Enable for one hour**, **Enable forever** or **Disable**.

## Removing a device

Use **Remove** on a row, or select several devices and click **Delete**. If the player is online, it clears its credentials and cache and returns to the registration screen.
