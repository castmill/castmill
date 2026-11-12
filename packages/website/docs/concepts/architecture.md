---
sidebar_position: 1
title: Architecture
description: The parts of a Castmill installation and how data flows between the server, the dashboard and the players.
---

# Architecture

A Castmill installation has three parts: a **server**, the **dashboard** that people use to manage content, and **players** that run on the screens. All three talk to each other over HTTPS and WebSockets.

<Flow steps={["Dashboard|Web app for users", "Server|API, scheduling, storage", "Players|Screens and kiosks"]} />

## Components

| Component | Technology | Responsibility |
| --- | --- | --- |
| Server | Elixir and Phoenix | REST API, authentication, permissions, quotas, media processing, background jobs, WebSocket connections to dashboards and players, the admin tool and the MCP server for AI agents |
| Database | PostgreSQL | All data, including the background job queue. No other database or cache is needed. |
| Media storage | Local disk or S3-compatible object storage | Uploaded files and their generated thumbnails and transcodes |
| Dashboard | SolidJS single-page app | The web interface described in the [user guide](../dashboard/overview.md). Available in nine languages, with light and dark themes. |
| Players | TypeScript, packaged per platform | Download schedules and content, cache them, and render them on screen. See [Players](../players/overview.md). |

The server is a single application. For larger installations you can run several copies and split web traffic from background work; see [Self-hosting](../administration/self-hosting.md#scaling).

## How content reaches a screen

<Flow steps={["Media|Images and video", "Playlist|Ordered items", "Channel|Weekly schedule", "Device|A registered player"]} />

1. Users upload media and build playlists and layouts in the dashboard.
2. They schedule playlists on channels and assign channels to devices.
3. Each player keeps a WebSocket connection to the server. When something it plays changes, the server tells the player, and the player fetches the new data over HTTPS.
4. The player stores what it downloaded in a local cache and plays from there. If the connection drops, it keeps playing the cached schedule and reconnects in the background.

The player decides what to show at each moment from the cached channel schedule, so the server does not need to be reachable for playback to continue. See [Offline playback and caching](../players/offline-and-caching.md).

## Multi-tenancy

Castmill separates customers and departments with two levels of tenancy.

| Level | Purpose | Separated by |
| --- | --- | --- |
| [Network](./networks.md) | A complete, branded Castmill service on its own domain, for example one per reseller or customer | Domain name |
| [Organization](./organizations.md) | A workspace for one company, site or department inside a network | Membership |

Resources such as media, playlists, channels and devices always belong to exactly one organization. Users can belong to organizations in the same network and switch between them in the dashboard.

## Extending Castmill

Most dashboard pages, including Medias, Playlists, Layouts, Widgets and Devices, are **add-ons**: modules that plug a server part and a dashboard part into Castmill. The same mechanism is open to your own features. Other extension points are template widgets, feeds, webhooks, the REST API and the MCP server. The [developer overview](../developers/overview.md) compares them.

## Security model

- People sign in to the dashboard with passkeys; see [Authentication](./authentication.md).
- The server checks the user's role on every request; see [Users, roles and teams](./users-and-teams.md).
- Players authenticate with a device token issued when the device is registered.
- AI agents and feeds use separate, revocable tokens.
- Third-party API keys and OAuth tokens are encrypted at rest with `ENCRYPTION_MASTER_KEY`.
