---
sidebar_position: 3
---

# Playlists

Playlists are **ordered sequences of widget instances** that play on your devices. Each item in a playlist has a duration and a configuration that controls what is displayed.

## Creating a Playlist

1. Navigate to **Content → Playlists**
2. Click **Create** (or press **Ctrl+N**)
3. Enter a **name** and select an **aspect ratio**:
   - 16:9 (landscape — most common)
   - 9:16 (portrait)
   - 4:3 (traditional)
   - 21:9 (ultrawide)
   - 1:1 (square)
   - Custom dimensions
4. Click **Create**

The aspect ratio determines the proportions of the preview and affects how content renders on devices.

## Playlist Editor

Opening a playlist reveals the **three-column editor**:

### Widget Chooser (Left Column)

A searchable list of all available widget types. Each entry shows the widget's icon, name, and a brief description.

**To add a widget**: drag it from the chooser and drop it onto the playlist items list. The widget is inserted at the drop position.

### Playlist Items (Center Column)

The ordered list of widget instances in the playlist. Each item shows:

- **Widget icon and name**
- **Duration** (in seconds)
- **Drag handle** for reordering

**Actions:**

| Action        | How                                           |
| ------------- | --------------------------------------------- |
| **Reorder**   | Drag items up or down within the list         |
| **Configure** | Click an item to open its configuration panel |
| **Remove**    | Click the delete button on an item            |

### Live Preview (Right Column)

A real-time rendering of the playlist using the actual Castmill player engine. The preview:

- Plays through items sequentially with their configured durations
- Updates instantly when you change widget options
- Supports **seek-to-item** — clicking an item in the list jumps the preview to that item

## Widget Configuration

When you click a playlist item, a configuration panel opens. The form is **dynamically generated** from the widget's `options_schema`, meaning each widget type has its own set of configuration fields.

### Common Field Types

| Type                   | Control                   | Example                                 |
| ---------------------- | ------------------------- | --------------------------------------- |
| **Text**               | Text input                | Headline, caption                       |
| **Number**             | Number input with min/max | Duration, font size                     |
| **Boolean**            | Toggle switch             | Show title, autoplay                    |
| **Color**              | Color picker              | Background color, text color            |
| **URL**                | URL input with validation | Web page address                        |
| **Media reference**    | Searchable dropdown       | Select an uploaded image or video       |
| **Playlist reference** | Searchable dropdown       | Nest a playlist inside a layout zone    |
| **Select**             | Dropdown                  | Transition effect, alignment            |
| **Layout**             | Visual zone editor        | Multi-zone screen arrangement           |
| **Layout reference**   | Zone → playlist mapper    | Assign playlists to layout zones        |
| **Location**           | Map picker                | Geographic location for weather widgets |

### Validation

- Required fields are marked and validated before saving
- Number fields enforce minimum and maximum bounds
- URL fields validate format
- The **Save** button is disabled until all required fields are valid

### Default Values

Each field in the schema can define a default value, which is applied automatically when you add a new widget to the playlist.

## Widget Duration

- **Static widgets** (images, text): default duration of 10 seconds, configurable per item
- **Dynamic widgets** (videos, scrollers): duration is set to 0, meaning the player uses the widget's actual runtime (e.g., video length or scroller cycle time)

## Integration Credentials

Some widgets require external service credentials (e.g., weather API keys). When you add such a widget, the dashboard checks whether the required credentials are configured. If they are missing, a prompt appears directing you to the widget's integration settings page.

## Circular Reference Prevention

When using **layout-ref** fields (assigning playlists to layout zones), the system prevents circular references. If Playlist A is nested inside Playlist B via a layout zone, then Playlist B cannot be selected as a reference inside Playlist A. The ancestor chain is computed automatically and excluded from the selection dropdown.
