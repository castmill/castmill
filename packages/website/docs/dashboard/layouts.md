---
sidebar_position: 6
---

# Layouts

Layouts define **multi-zone screen arrangements** — they let you divide a screen into rectangular regions, each playing its own playlist simultaneously.

## How Layouts Work

A layout is a set of **zones** positioned on a canvas with a specific aspect ratio. Each zone is a rectangle defined by:

- **Position** — X and Y coordinates (as percentages of the canvas)
- **Size** — Width and height (as percentages of the canvas)
- **Z-index** — Stacking order when zones overlap
- **Name** — A label for identification (e.g., "Main", "Ticker", "Logo")

Using percentage-based coordinates ensures layouts scale correctly across different screen resolutions.

## Creating a Layout

1. Navigate to **Content → Layouts**
2. Click **Create**
3. Enter a **name**, optional **description**, and select an **aspect ratio**:
   - 16:9 (landscape)
   - 9:16 (portrait)
   - 4:3 (traditional)
   - 21:9 (ultrawide)
   - 1:1 (square)
4. Click **Create**

## Layout Editor

The layout editor provides a **visual canvas** where you can design your zone arrangement:

### Adding Zones

Click **Add Zone** to place a new rectangular zone on the canvas. Each zone starts with a default size and position.

### Editing Zones

- **Resize** — Drag the edges or corners of a zone to change its dimensions
- **Reposition** — Drag a zone to move it to a new location
- **Name** — Click the zone label to rename it
- **Z-index** — Adjust the stacking order for overlapping zones

### Removing Zones

Select a zone and click the delete button to remove it from the layout.

### Saving

Click **Save** to persist your changes. The layout is stored with its zone definitions and aspect ratio.

## Using Layouts in Playlists

Layouts are used through the **Layout widget** in playlists. When you add a Layout widget to a playlist:

1. The widget's configuration shows a **layout selector** — choose one of your saved layouts
2. A **zone-to-playlist mapper** appears, showing each zone in the layout
3. For each zone, select a **playlist** from a dropdown
4. Each zone independently plays its assigned playlist

This lets you create complex multi-region displays — for example, a main content area with a news ticker at the bottom and a logo in the corner.

```
┌─────────────────────────────────┐
│                                 │
│         Main Content            │
│         (Playlist A)            │
│                                 │
├────────────────────┬────────────┤
│   News Ticker      │    Logo    │
│   (Playlist B)     │ (Playlist C)│
└────────────────────┴────────────┘
```

## Layout Reference and Circular Prevention

When mapping zones to playlists, the system prevents **circular references**. If the current playlist (Playlist X) is being edited and you add a Layout widget, you cannot assign Playlist X to any of the layout's zones — because that would create an infinite loop. The ancestor chain is automatically computed and excluded.
