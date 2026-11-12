---
sidebar_position: 3
title: Your first screen
description: A step-by-step tutorial that takes an image from upload to a playing screen.
---

# Your first screen

In this tutorial you upload an image, put it in a playlist, schedule the playlist on a channel and play the channel in a browser window that acts as a screen. It takes about ten minutes and works the same on a [local installation](./quick-start.md) and on a hosted one.

You need:

- A Castmill account with the admin or manager role. A new account is the admin of its own organization.
- One or two images or a short video.
- A second browser window, or another computer or tablet, to act as the screen.

<Steps>

### Upload media

1. In the sidebar, open **Content → Medias**.
2. Choose **Upload Media**, then drag your files into the dialog or select them.
3. Choose **Upload**.

Castmill creates thumbnails for images and transcodes videos in the background. The media is ready when its thumbnail appears. See [Media](../dashboard/media.md) for supported formats and limits.

### Build a playlist

1. Open **Content → Playlists** and choose **Add Playlist**. Name it, for example *Lobby*.
2. Open the playlist. The editor shows the available widgets on one side and the playlist on the other.
3. Drag the **Image** widget into the playlist, then select the image you uploaded and confirm.
4. Set the **Duration**, for example 10 seconds.
5. Repeat for more images. Use the **Video** widget for videos; a video item plays for the length of the video.

The preview at the top of the editor plays the playlist as a screen would show it. [Playlists](../dashboard/playlists.md) covers transitions, aspect ratios and the other widgets.

### Create a channel

A channel decides which playlist plays at what time.

1. Open **Channels** and choose **Add Channel**. Name it *Lobby screen*.
2. Open the channel and set its **Timezone** to the location of the screen.
3. Set **Default playlist** to *Lobby*.

The default playlist plays whenever the calendar has no other entry, so this channel now plays *Lobby* around the clock. You can add time-based entries later; see [Channels](../dashboard/channels.md).

### Start a player

Any modern browser can act as a Castmill player.

1. In a new browser window, open the address of your Castmill server, for example http://localhost:4000 for a local installation.
2. The player shows a **pincode** of 10 characters. Keep this window open.

For permanent installations, use one of the dedicated [players](../players/overview.md) instead. They start automatically, run full screen and keep playing without a network connection.

### Register the device

1. In the dashboard, open **Devices** and choose **Add Device**.
2. Enter a name, for example *Lobby*, and type the pincode shown by the player.
3. Choose **Register**.

The player switches from the pincode to content within a few seconds. A pincode expires after one hour; reload the player to get a new one.

Castmill gives every newly registered device its own channel, named after the device, with a welcome playlist. That is what the player shows now.

### Assign your channel

1. Open the device in **Devices** and select the **Channels** tab.
2. Add *Lobby screen*.
3. Remove the channel that was created for the device.

The player switches to your playlist. Your first screen is live.

</Steps>

## What you can do next

<CardGrid>
  <Card title="Schedule by time" href="/docs/dashboard/channels" icon="calendar">
    Play different playlists in the morning, at lunch and after hours.
  </Card>
  <Card title="Split the screen" href="/docs/dashboard/layouts" icon="layout">
    Show a video, a news ticker and the weather side by side.
  </Card>
  <Card title="Add live data" href="/docs/dashboard/widgets" icon="widget">
    Add weather, RSS headlines, QR codes or your own data.
  </Card>
  <Card title="Monitor the device" href="/docs/dashboard/devices" icon="monitor">
    See a live preview, telemetry and events, and run maintenance actions.
  </Card>
  <Card title="Install a real player" href="/docs/players/overview" icon="rocket">
    Android, LG webOS, macOS and Linux players.
  </Card>
  <Card title="Invite your team" href="/docs/dashboard/teams" icon="users">
    Add colleagues and give them the role they need.
  </Card>
</CardGrid>
