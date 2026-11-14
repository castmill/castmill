---
sidebar_position: 4
title: Layouts
description: Split the screen into zones and play a different playlist in each zone.
---

# Layouts

A layout divides the screen into rectangular zones. Combined with the **Layout Widget**, each zone plays its own playlist at the same time, for example a main area with a news strip below it and a logo in a corner. You manage layouts in **Content → Layouts**.

## How layouts work

A layout has an aspect ratio and a list of zones. Each zone has:

- a **Name**, such as "Main" or "Ticker";
- a position, **X (%)** and **Y (%)**, and a size, **Width (%)** and **Height (%)**, as percentages of the screen;
- a stacking order, used when zones overlap.

Because positions and sizes are percentages, the same layout fits any screen resolution with the same aspect ratio.

The layout only describes the zones. Which playlist plays in which zone is set in the Layout widget, so you can reuse one layout with different playlists.

## Creating a layout

1. Open **Content → Layouts**.
2. Click **Add Layout**.
3. Enter a name of at least 3 characters.
4. Choose an **Aspect Ratio**: 16:9 (landscape, the default), 9:16 (portrait), 4:3, 21:9 (ultrawide), 1:1 (square) or **Custom**. A custom ratio uses the format `width:height`, for example `32:9`.
5. Click **Create**. The layout opens in the editor.

## Editing zones

The editor shows the layout as a canvas.

| Task | How |
| --- | --- |
| Start from a template | Click **Templates** and choose one, such as Full Screen, 2 Columns, 3 Rows, 2×2 Grid, Main + Sidebar, Header + Content or Picture in Picture. A template replaces the current zones. |
| Add a zone | Click **Add Zone** |
| Move or resize a zone | Drag the zone, or drag its edges and corners |
| Set exact values | Select the zone and edit **Name**, **X (%)**, **Y (%)**, **Width (%)** and **Height (%)** |
| Change the stacking order | Use **Bring Forward** and **Send Backward** |
| Make a zone fill the screen | Use the fill width, fill height or fill both buttons |
| Spread zones evenly | Use the buttons that distribute all zones in columns or rows |
| Remove a zone | Click **Delete Zone** |

Click **Save** to store the layout. You can also change its name and description here.

<Screenshot src="layouts-editor" alt="The layout editor with a main zone and two sidebar zones, and the properties of the selected Main zone" />

## System layouts

Castmill includes the system layout **Portrait 3 Zones**: three zones of equal height stacked vertically, for 9:16 portrait screens. System layouts appear in the layout list of every organization.

## Using a layout in a playlist

1. Open the playlist that should show the layout. See [Playlists](./playlists.md).
2. Add the **Layout Widget**.
3. In the widget settings, choose a layout with **Select Layout**.
4. Under **Assign Playlists to Zones**, choose a playlist for each zone.
5. Click **Add to playlist**.

When the item plays, every zone plays its playlist independently. The item's duration decides how long the whole layout stays on screen.

<Screenshot src="layouts-widget" alt="The Layout Widget settings with a playlist assigned to each zone and a preview that plays all three zones" />

:::tip
Create the zone playlists with the same aspect ratio as the zone, so that the preview in the playlist editor matches what the zone shows.
:::

## Circular references

A playlist cannot contain itself, directly or through other layouts. If playlist A shows playlist B in a zone, you cannot assign playlist A to a zone of a layout inside playlist B, because it would play forever.

The dashboard removes such playlists from the zone picker, and the server rejects any change that would create a loop.

## Deleting a layout

Select layouts in the list and delete them, or use the delete action on a row. Check first that no Layout widget still uses the layout.
