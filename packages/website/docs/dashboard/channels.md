---
sidebar_position: 4
---

# Channels

Channels define **when** playlists play on your devices. Each channel has a **weekly calendar** where you schedule playlist entries across time slots.

## Creating a Channel

1. Navigate to **Channels** in the sidebar
2. Click **Create** (or press **Ctrl+N**)
3. Enter a **name** and select a **timezone**
   - The timezone defaults to your browser's timezone
   - All times in the calendar are displayed in the channel's timezone
4. Click **Create**

## Channel Editor

Opening a channel reveals a **two-panel layout**:

### Playlist Panel (Left)

- **Default playlist** — A dropdown at the top lets you set a fallback playlist that plays during unscheduled times
- **Playlist chooser** — A list of available playlists that you can drag onto the calendar

### Weekly Calendar (Right)

A **7-day week view** (Monday through Sunday) with **30-minute time slots** (48 slots per day).

**Navigation controls:**

| Control          | Action                                |
| ---------------- | ------------------------------------- |
| **← / →** arrows | Move to previous / next week          |
| **Today** button | Jump to the current week              |
| **Date range**   | Shows the displayed week's date range |

**Visual elements:**

- **Current time indicator** — A horizontal blue bar with clock label that updates every 60 seconds
- **Auto-scroll** — The calendar scrolls to the current time on load
- **Entries** — Colored blocks spanning their scheduled time range

## Scheduling Playlists

### Creating Entries

**Drag and drop** a playlist from the left panel onto a calendar cell. This creates an entry starting at that time slot. By default, entries span one hour (two 30-minute slots).

### Modifying Entries

| Action           | How                                                     |
| ---------------- | ------------------------------------------------------- |
| **Move**         | Drag an entry to a different time slot or day           |
| **Resize**       | Drag the bottom edge of an entry to change its duration |
| **Delete**       | Click the delete button on the entry                    |
| **View details** | Click an entry to open its detail view                  |

### Repeat Weekly

In the entry detail view, you can toggle **"Repeat weekly"** to make the entry recur every week. This is useful for recurring schedules (e.g., a morning news playlist every weekday at 8:00 AM).

### Overlap Prevention

The calendar enforces **no-overlap** rules. If you try to drop or resize an entry into a time slot that is already occupied, the action is prevented. Both day ranges and time ranges are checked to detect conflicts.

## Default Playlist

The default playlist acts as a **fallback** — it plays whenever no scheduled entry is active. This ensures your devices always show content, even during gaps in the schedule.

Set the default playlist using the dropdown at the top of the playlist panel.

## Timezone Handling

Each channel stores its own timezone. All times displayed in the calendar are relative to this timezone, regardless of your browser's local time. This is important for managing devices in different geographic locations.

## Assigning Channels to Devices

After creating a channel and scheduling playlists, you assign it to one or more devices. This is done from the **Devices** page — see [Devices](devices.md) for details.

:::info
A channel cannot be deleted if it is currently assigned to any device. The dashboard shows which devices reference the channel and prevents deletion until all assignments are removed.
:::
