---
sidebar_position: 6
title: Channels
description: Schedule playlists on a weekly calendar in the channel's timezone, with a default playlist for unscheduled time.
---

# Channels

A channel decides **when** each playlist plays. It has a timezone, a weekly calendar of playlist entries and an optional default playlist that fills the time between entries. You assign channels to devices, and one channel can drive many devices. You manage channels in **Channels** in the sidebar.

## Creating a channel

1. Open **Channels**.
2. Click **Add Channel**.
3. Enter a name.
4. Choose a **Timezone**. It defaults to your browser's timezone.
5. Click **Create**.

<Screenshot src="channels-create" alt="The New Channel dialog with a name and the Europe/Stockholm timezone" width={406} />

All times in the channel are wall-clock times in the channel's timezone, wherever you or the screens are. A 09:00 entry in a Europe/Stockholm channel starts at 09:00 Stockholm time. Choose the timezone of the place where the screens are.

:::note
A device registered through the dashboard gets its own channel, named "*device name* Default", in the UTC timezone. See [Devices](./devices.md#registering-a-device).
:::

## The channel editor

Click a channel to open it. The editor shows, from top to bottom:

- a reminder that the channel needs a default playlist or a scheduled entry to show content;
- the **Automations** assigned to the channel (see [Automations on a channel](#automations-on-a-channel));
- the **Default playlist** selector and the **Drag playlists** list;
- the weekly calendar.

<Screenshot src="channels-editor" alt="A channel with an automation, the default playlist, the playlists to drag and a weekly calendar of lunch, happy hour and brunch entries" />

### The weekly calendar

The calendar shows one week, Monday to Sunday, in 30-minute slots. Use the previous, today and next buttons to move between weeks. A line marks the current time, and the calendar scrolls to it when it opens.

## Scheduling playlists

### Adding an entry

Drag a playlist from **Drag playlists** onto a slot of the calendar. The entry starts at that slot and lasts one hour.

### Changing entries

| Task | How |
| --- | --- |
| Move an entry | Drag it to another day or time |
| Change its length | Drag its edges |
| Repeat it every week | Click the entry, switch on **Repeat Weekly?** and click **Update** |
| Delete it | Use the delete button on the entry, and confirm **Remove Channel Entry** |

<Screenshot src="channels-entry" alt="The details of a calendar entry with its playlist and the Repeat Weekly switch turned on" width={376} />

An entry without **Repeat Weekly?** plays once, in the week where you placed it. A weekly entry repeats on the same weekday and time every week.

### No overlaps

Entries in one channel cannot overlap. The calendar refuses a drop or a resize that would overlap another entry, so at any time at most one entry is active.

## Default playlist

The default playlist plays whenever no entry is active. Choose it with **Default playlist**, or remove it with **Clear default playlist**.

If a channel has neither an active entry nor a default playlist, it has nothing to play at that moment. A device with several channels then skips it; a device with only that channel shows no content.

:::tip
Always set a default playlist, so screens never go blank between scheduled entries.
:::

## Automations on a channel

Automations can interrupt a channel's programming, for example to play an offer every hour. The **Automations** section of a channel lists the automations assigned to it, and **Show firings on the calendar** marks when they fire in the displayed week. **Manage automations** opens the Automations page, where you assign automations to channels. Every device that plays the channel runs these automations. See [Automations](./automations.md).

## Assigning a channel to devices

You assign channels from the device: open the device in **Devices**, go to **Channels** and add the channel. A device with several channels plays them in turn. See [Devices](./devices.md#channels).

## Deleting a channel

Use **Remove** on a row, or select several channels and click **Delete**. A channel that is assigned to a device cannot be deleted: the dashboard shows **Cannot Delete Channel** with the devices that use it. Remove the channel from those devices first.
