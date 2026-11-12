---
sidebar_position: 6
title: Content model
description: How media, widgets, playlists, layouts, channels, automations and devices relate to each other.
---

# Content model

Every screen shows the result of a chain of resources. Knowing the chain makes it easy to predict what a change will affect.

<Flow steps={["Media and feeds|Raw material", "Widgets|How to show it", "Playlists and layouts|In what order and where", "Channels|When", "Devices|On which screen"]} />

## Resources

| Resource | What it is | Contains or refers to |
| --- | --- | --- |
| **Media** | An uploaded image or video, with generated thumbnails and transcodes | — |
| **Feed** | A list of JSON entries, or one JSON document, written by an external system | — |
| **Widget** | A template that turns options and data into something on screen, such as an image, a video, a weather forecast or a news ticker | Media, feeds or external data, depending on the widget |
| **Playlist** | An ordered list of items. Each item is a configured widget with a duration and an optional transition. | Widgets, and through them media and feeds |
| **Layout** | A screen divided into zones | — |
| **Layout widget** | A playlist item that shows a layout and plays one playlist in each zone | A layout and one playlist per zone |
| **Channel** | A weekly calendar of playlists in one timezone, with a default playlist for unscheduled time | Playlists |
| **Automation** | A rule that interrupts normal playback with a playlist at set times | Playlists, devices and channels |
| **Device** | A registered player | One or more channels |
| **Tag** | A label for finding and filtering resources | Any resource |
| **Team** | A group of users and resources | Users and resources |

## Reuse and change propagation

Resources are linked by reference, not copied. Change a playlist and every channel that schedules it, every layout zone that plays it and every device that shows those channels gets the change. Players are notified over their WebSocket connection and download the update, usually within seconds.

Because of these references, Castmill stops you from deleting things that are still in use. For example, a playlist that an automation plays cannot be deleted until the automation no longer uses it, and a channel that is the only channel of a device cannot be removed from it.

## What a device plays at a given moment

1. If an [automation](../dashboard/automations.md) for the device or one of its channels is due, its playlist interrupts playback, then normal playback resumes.
2. Otherwise the player looks at its [channels](../dashboard/channels.md). For each channel, the calendar entry for the current time in the channel's timezone wins; if there is none, the channel's default playlist plays.
3. If a device has several channels, it plays them in turn: the current playlist of the first channel, then the second channel, and so on. A channel with nothing to play at that moment is skipped.
4. Each playlist plays its items in order and starts over at the end.

## Aspect ratio and orientation

Playlists and layouts have an aspect ratio, such as 16:9 or 9:16, which the editors use for previews and zone sizes. The device's **orientation** (0, 90, 180 or 270 degrees) decides how the player rotates its output to match a physically rotated screen. Design portrait content with a portrait aspect ratio and set the device orientation to match how the screen is mounted. See [Devices](../dashboard/devices.md#orientation).

## Organization boundaries

All resources belong to one organization. Playlists can only use media, widgets and feeds from the same organization, plus the system widgets that the network makes available. To show the same content in two organizations, upload it to both.
