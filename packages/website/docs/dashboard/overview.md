---
sidebar_position: 1
title: Dashboard overview
description: Find your way around the Castmill dashboard, its navigation, search, filters and keyboard shortcuts.
---

# Dashboard overview

The dashboard is the web application you use to manage content, screens and people in Castmill. Everything you do in it happens inside one [organization](../concepts/organizations.md), and what you can see and change depends on your [role](../concepts/users-and-teams.md).

## Layout

- **Sidebar** on the left: the organization switcher and the navigation.
- **Top bar**: global search, **Help** (this documentation), **Getting Started** (the onboarding checklist and tour), **Notifications**, the light and dark mode toggle, and your user menu with **Settings** and log out.
- **Main area**: the list or editor you opened.

## Navigation

| Sidebar entry | What you do there |
| --- | --- |
| **Organization** | Members, invitations and organization settings |
| **Content → Medias** | Upload images and videos ([Media](./media.md)) |
| **Content → Playlists** | Build sequences of content ([Playlists](./playlists.md)) |
| **Content → Layouts** | Split the screen into zones ([Layouts](./layouts.md)) |
| **Content → Widgets** | Browse widgets and set up integrations ([Widgets](./widgets.md)) |
| **Channels** | Schedule playlists on a weekly calendar ([Channels](./channels.md)) |
| **Automations** | Interrupt playback at set times ([Automations](./automations.md)) |
| **Devices** | Register and monitor screens ([Devices](./devices.md)) |
| **Feeds** | Push live data from other systems ([Feeds](./feeds.md)) |
| **Tags** | Label and group resources ([Tags](./tags.md)) |
| **Teams** | Group people and resources ([Teams](./teams.md)) |
| **Agents** | Connect AI assistants over MCP ([AI agents](./ai-agents.md)) |
| **Usage** | Check consumption against your plan ([Usage and quotas](./usage-and-quotas.md)) |

Entries you have no permission for are hidden. Network administrators also see a **Network** section with **Overview**, **Settings**, **Organizations**, **Users & Invitations** and **Widget Access**; see [Network administration](../administration/network-administration.md).

Addons can add their own entries to the sidebar. See [Addons](../developers/addons.md).

## Addresses you can share

Every page address includes the organization, for example `/org/<organization id>/content/playlists`. You can bookmark a page or send a link to a colleague, and it opens in the right organization. Adding `?itemId=<id>` to a list address opens that item directly; global search uses this.

## Search

Press **Ctrl+F** (**⌘F** on macOS) or click the search field in the top bar to search across medias, playlists, channels, devices and teams at once. Results are grouped by type. Press **S** on a list page to search only that list.

## Lists, filters and bulk actions

The list pages for medias, playlists, layouts, channels and devices work the same way:

- **Filters**: show only the resources of one team, or those with certain tags. With several tags you choose whether a resource must match **any** or **all** of them.
- **Views**: switch between the table and a tree grouped by tag group and tag.
- **Bulk actions**: select rows with the check boxes to delete them or to add and remove tags in one step.

## Keyboard shortcuts

Press **Shift+?** to see every shortcut that works on the current page.

| Shortcut | Action |
| --- | --- |
| **Shift+?** | Show the shortcut legend |
| **Ctrl+F** | Global search |
| **C** | Create a resource on the current page |
| **S** | Search the current list |
| **Delete** | Delete the selected resources |
| **Ctrl+M** | Go to Medias |
| **Ctrl+P** | Go to Playlists |
| **Ctrl+L** | Go to Layouts |
| **Ctrl+I** | Go to Widgets |
| **Ctrl+C** | Go to Channels |
| **Ctrl+D** | Go to Devices |
| **Ctrl+G** | Go to Teams |
| **Ctrl+O** | Go to Organization |

On macOS, use **⌘** instead of **Ctrl**. Single-key shortcuts are ignored while you type in a text field.

## Language and theme

The dashboard is available in English, Spanish, Swedish, German, French, Chinese, Arabic, Korean and Japanese. Change the language in **Settings**. The toggle in the top bar switches between the light and dark themes, and the dashboard remembers your choice.

## Getting started checklist

The **Getting Started** button opens a checklist that guides new users through uploading media, creating a playlist, creating a channel, registering a device and tagging content. Each step links to the matching page of this guide. You can restart the tour from **Settings**.
