---
sidebar_position: 2
title: FAQ
description: Answers to common questions about content, screens, offline playback, hosting and integrations.
---

# Frequently asked questions

## General

### What hardware can I use?

Any device with a modern web browser, Android 5.1 or later, LG webOS signage displays, and macOS or Linux computers through the Electron player. See [Players](../players/overview.md) for a comparison.

### Is Castmill free?

Castmill is open source under the GNU Affero General Public License v3.0. You can host it yourself at no cost. See [Self-hosting](../administration/self-hosting.md).

### Which languages does the dashboard support?

English, Spanish, Swedish, German, French, Chinese, Arabic, Korean and Japanese. Each user chooses a language in **Settings**.

## Content

### Which file types can I upload?

Images and videos. Castmill creates thumbnails and previews of images and transcodes videos so that every player can play them. See [Media](../dashboard/media.md).

### How do I show different content in the morning and the afternoon?

Create a playlist for each part of the day and schedule them in a [channel](../dashboard/channels.md). For something that happens briefly at set times, such as a reminder every hour, use an [automation](../dashboard/automations.md) instead.

### How do I show the same message on all screens at once?

Add the playlist to a channel that all devices play, or create an [automation](../dashboard/automations.md) assigned to the devices that interrupts playback at the time you choose.

### How do I show data from another system?

Create a [feed](../dashboard/feeds.md) and send data to it from your system, Make or Zapier. A widget that reads the feed updates on every screen when the data changes. For third-party services, use a widget with a [data integration](../developers/widgets/data-integrations.md).

### How do I use a portrait screen?

Build playlists with a portrait aspect ratio such as 9:16, and set the device's orientation to match how the screen is mounted. See [Devices](../dashboard/devices.md#orientation).

## Screens

### What happens when a screen loses its internet connection?

It keeps playing. Players store everything they need, including media, widget code and data, and follow their schedules and automations offline. When the connection returns, they download what changed. See [Offline playback and caching](../players/offline-and-caching.md).

### How quickly do changes reach the screens?

Usually within seconds. Players keep a connection open to the server and are told about changes as soon as you save them. New media must be downloaded before it plays.

### A screen shows a registration code again. What happened?

The device was removed from its organization, or its stored credentials were lost, for example after a factory reset. Register it again with the new code. See [Troubleshooting](../players/troubleshooting.md).

### Can I see what a screen is showing right now?

Open the device in **Devices**. The **Preview** tab shows what the device should be playing according to its schedule, and the **Telemetry** and **Events** tabs show its state and recent activity.

## Accounts and access

### How do I sign in without a password?

Castmill uses passkeys, which your device or password manager stores. If you lose access to your passkeys, use **Lost your credentials?** on the sign-in page to receive a recovery email. See [First sign-in](../getting-started/first-login.md).

### How do I give a colleague access to only some screens?

Invite them with a role that fits their work, such as **Editor** or **Device manager**, and use [teams](../dashboard/teams.md) to group the resources they work with. See [Users and teams](../concepts/users-and-teams.md).

### Why can't I create more devices or upload more media?

Your organization has reached a quota. **Usage** shows your consumption. Ask your network operator to raise the limit. See [Usage and quotas](../dashboard/usage-and-quotas.md).

## Hosting and development

### What does a server need?

The Castmill server, PostgreSQL and an SMTP server. There is no separate cache or message broker. See [Self-hosting](../administration/self-hosting.md).

### Can I build my own widgets?

Yes. Widgets are JSON templates that you upload in the dashboard. See [Widget development](../developers/widgets/overview.mdx).

### Can AI assistants work with Castmill?

Yes. Castmill includes an MCP server, so assistants such as Claude, GitHub Copilot or Cursor can manage content and screens with the permissions you give them. See [AI agents](../dashboard/ai-agents.md).
