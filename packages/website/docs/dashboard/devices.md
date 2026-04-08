---
sidebar_position: 5
---

# Devices

Devices represent the physical screens that display your digital signage content. The Devices page lets you register new devices, view their status, and configure what they show.

## Registering a Device

Castmill uses a **pincode pairing system** to connect physical devices to your organization:

1. **On the physical device** — Open the Castmill player application. It displays a **10-character pincode** on screen.
2. **In the dashboard** — Navigate to **Devices** and click **Register**
3. Enter a **name** for the device and the **pincode** shown on the device's screen
4. Click **Register**

The device is now associated with your organization and will begin receiving content.

:::tip
You can also open a **browser-based player** at your Castmill server's root URL (e.g., `http://localhost:4000`) for testing purposes. It displays a pincode just like a physical device.
:::

## Device List

The device list shows all registered devices with:

- **Name** — The device's display name
- **Status** — Online/offline indicator
- **Tags** — Any assigned tags
- **Timestamps** — Registration date and last update

A **quota indicator** at the top shows how many devices you have registered versus your plan limit.

## Device Detail View

Clicking a device opens a detail view with **eight tabs**:

### Details Tab

View and edit the device's basic information:

- **Name** and **Description**
- **Location** — Where the device is physically installed
- **Metadata** — Additional device information (IP address, last online, etc.)

### Channels Tab

Assign one or more **channels** to the device. Each channel brings its own weekly schedule of playlists. When multiple channels are assigned, the device plays content from all of them according to their schedules.

### Preview Tab

A **live preview** showing what the device is currently displaying. This uses the actual player engine to render the scheduled content in real time.

### Cache Tab

View and manage the device's **content cache**. Devices cache media files locally for offline playback. This tab shows:

- Cached files and their status
- Cache size usage
- Options to clear or refresh the cache

### Maintenance Tab

Perform maintenance operations on the device:

- **Restart** the player application
- **Update** the player software
- Other administrative actions

### Events Tab

A **log of device events** — connection changes, errors, content updates, and other notable occurrences. Useful for troubleshooting device issues.

### Telemetry Tab

**Hardware and software metrics** from the device:

- CPU and memory usage
- Storage capacity
- Network connectivity
- Player version and platform information

### Schedule Tab

View the device's **on/off schedule** — when the device should be active or in standby. This is separate from the content schedule and controls the device's power state.

## Device Status

Devices report their connection status in real time:

- **Online** — The device is connected and receiving updates
- **Offline** — The device has not communicated recently

The last known connection time is displayed in the device details.

## Log Levels

Each device has a configurable **log level** that controls the verbosity of event reporting:

| Level      | Description                                   |
| ---------- | --------------------------------------------- |
| `trace`    | Most verbose — all internal operations        |
| `debug`    | Detailed debugging information                |
| `info`     | General operational events                    |
| `warning`  | Potential issues that don't prevent operation |
| `error`    | Failures that affect content display          |
| `critical` | Severe failures requiring attention           |
