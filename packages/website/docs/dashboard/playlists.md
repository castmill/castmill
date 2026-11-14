---
sidebar_position: 3
title: Playlists
description: Build ordered sequences of widgets, set their durations and preview them before they reach your screens.
---

# Playlists

A playlist is an ordered list of items. Each item is a widget, such as an image, a video, a web page or a weather forecast, with its own settings and a duration. Screens play the items in order and start again from the top. You manage playlists in **Content → Playlists**.

## Creating a playlist

1. Open **Content → Playlists**.
2. Click **Add Playlist**.
3. Enter a name of at least 3 characters.
4. Choose an **Aspect Ratio**. The default is 16:9.
5. Click **Create**. The playlist opens in the editor.

<Screenshot src="playlists-create" alt="The Add Playlist dialog with a name and the 16:9 aspect ratio" width={340} />

### Aspect ratios

The aspect ratio decides the shape of the editor preview. Choose the shape of the screens that will show the playlist.

| Preset | Use |
| --- | --- |
| **16:9 (Landscape)** | Standard landscape screens (default) |
| **9:16 (Portrait)** | Screens mounted in portrait |
| **4:3 (Classic)** and **3:4 (Portrait)** | Older or square-ish screens |
| **21:9 (Ultrawide)** | Ultrawide screens |
| **16:3 (Shelf/Ticker)** and **3:16 (Shelf/Ticker Portrait)** | Shelf-edge and ticker strips |
| **1:1 (Square)** | Square screens |
| **Custom** | Enter a **Width** and **Height**. Each value must be a positive number of 100 or less, and the ratio cannot be more extreme than 10:1. |

You can change the aspect ratio later in the editor's **Settings** section.

## The playlist editor

The editor has these sections:

- **Content**: the widgets you can add and the items of the playlist.
- **Preview**: the playlist rendered by the Castmill player. On wide screens the preview sits next to the items and has no tab of its own.
- **Settings**: the aspect ratio.

The summary at the top shows the total duration and when the playlist was created and updated.

<Screenshot src="playlists-editor" alt="The playlist editor with the widget list, five items with their durations and a preview of the lunch specials slide" />

## Adding items

The **Widgets** list shows every widget available to your organization. Add a widget in one of these ways:

- Drag it into the item list, at the position where you want it. Drop it on **Drop here to add at the end** to append it.
- Click its **+** button to add it at the end.
- On a narrow screen, tap **Add widget**, then tap a widget.

A widget that has settings opens its settings dialog when you add it, so you can choose an image, enter a URL or set other options. Click **Add to playlist** to confirm. A widget without settings is added directly.

:::note Credentials Required
Some widgets read data from an external service and need an API key or an account connection first. If the credentials are missing, the dashboard shows **Credentials Required** with a **Go to Integrations** button that opens the widget's integration settings. See [Widgets](./widgets.md#integration-credentials).
:::

## Working with items

Each item shows the widget icon, its name and its duration.

| Action | How |
| --- | --- |
| Reorder | Drag the item, or use **Move up** and **Move down** |
| Edit settings | Click **Edit item** |
| Change duration | Use the **Duration** control on the item |
| Remove | Click **Remove item** and confirm |

### Durations

New items play for 10 seconds by default. Change the duration per item with the **Duration** control.

Some widgets have a dynamic duration: a video plays for its full length and some animated widgets run until they finish. Their duration shows **Auto** until the real length is known.

## Widget settings

The settings dialog, **Widget "name"**, is generated from the options that the widget declares. Typical fields are:

| Field | Control |
| --- | --- |
| Text, number, URL | Input field with validation |
| Yes/no setting | Switch |
| Colour | Colour picker |
| Option list | Dropdown |
| Media | **Select an Image**, **Select a Video** or **Select a Media** picker |
| Playlist | **Select a Playlist** picker |
| Layout | Layout selector with **Assign Playlists to Zones** (Layout widget) |
| Location | Map with **Search for a location...** |
| Choices | A searchable list of items provided by the widget's integration, for example a feed or a list of stocks |

Required fields must be filled in before you can save. If you close the dialog with changes, the dashboard asks whether to **Discard** them or **Keep editing**.

<Screenshot src="playlists-widget-settings" alt="The settings of a QR Code item, with fields for the content, caption and colours next to a live preview" />

### Editing texts in the preview

Template widgets can mark some of their texts as editable. For those widgets, click **Edit texts** in the settings dialog, then click a highlighted text in the preview and type a replacement. You can also hide a text or **Reset to original**. The list **Edited texts** shows every change for the item; **Reset all** removes them. Edited texts apply to this playlist item only.

## Using playlists

- Schedule a playlist on a [channel](./channels.md) as a calendar entry or as the channel's default playlist.
- Show a playlist in a zone of a [layout](./layouts.md) through the Layout widget.
- Play a playlist at set times with an [automation](./automations.md).

## Deleting a playlist

Use **Remove** on a row, or select several playlists and click **Delete**.

Castmill refuses to delete a playlist that is still in use:

- it is the default playlist of a channel;
- it is scheduled in a current or future channel entry;
- an automation rule plays it.

Remove those references first, then delete the playlist.
