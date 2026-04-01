---
sidebar_position: 2
---

# Guide

Castmill is a comprehensive digital signage platform. This guide introduces the core concepts and points you to the detailed documentation for each area.

## System Architecture

Castmill follows a hierarchical model: **Networks** contain **Organizations**, which contain all your content and devices. See [Architecture](concepts/architecture.md) for a detailed breakdown.

```
Network (domain-based isolation)
└── Organization (workspace)
    ├── Users & Teams (access control)
    ├── Medias (images, videos)
    ├── Playlists (content sequences)
    ├── Layouts (multi-zone arrangements)
    ├── Channels (weekly schedules)
    └── Devices (physical screens)
```

## Core Concepts

| Concept            | Description                                                             | Learn More                                   |
| ------------------ | ----------------------------------------------------------------------- | -------------------------------------------- |
| **Networks**       | Isolated environments tied to domains — all data stays within a network | [Networks](concepts/networks.md)             |
| **Organizations**  | Workspaces where teams collaborate, with plan-based quotas              | [Organizations](concepts/organizations.md)   |
| **Users & Teams**  | Role-based access (admin, member, viewer) with team-level permissions   | [Users & Teams](concepts/users-and-teams.md) |
| **Authentication** | Passwordless login using passkeys (WebAuthn)                            | [Authentication](concepts/authentication.md) |

## Content Workflow

The typical workflow for getting content onto a screen:

1. **Upload media** — Add images and videos to your media library
2. **Create a playlist** — Arrange widgets (media, text, web pages) in sequence
3. **Design a layout** _(optional)_ — Split the screen into zones, each with its own playlist
4. **Schedule on a channel** — Place playlists on a weekly calendar
5. **Assign to a device** — Connect the channel to one or more display screens

### Detailed Guides

- [Content & Media](dashboard/content.md) — Uploading and managing media files
- [Playlists](dashboard/playlists.md) — Creating and editing content sequences
- [Layouts](dashboard/layouts.md) — Multi-zone screen designs
- [Channels](dashboard/channels.md) — Weekly scheduling with drag-and-drop
- [Devices](dashboard/devices.md) — Registering and managing displays

## Dashboard

The [Dashboard](dashboard/overview.md) is the web-based management interface. Key features include:

- **Sidebar navigation** with organization selector and addon support
- **Table and tree views** for all resource types
- **Tag system** for organizing content across the platform — [Tags](dashboard/tags.md)
- **Usage monitoring** with visual quota indicators — [Usage & Quotas](dashboard/usage-and-quotas.md)
- **User settings** including passkey management and language selection — [Settings](dashboard/settings.md)

## Widgets

Widgets are the building blocks of playlists. Each widget type defines how a specific kind of content renders — images, videos, text tickers, web pages, and more.

Castmill includes built-in widgets and supports **custom widgets** that can be developed independently. See the [Widgets documentation](widgets/widgets.mdx) for the full reference.

## Extending Castmill

Castmill's **addon system** lets you extend the platform with new features. Addons are Elixir packages that register server-side routes and client-side UI components. See the [Addons guide](addons/addons.md) for implementation details.

## Running a Local S3 Server

For development without AWS, you can use [MinIO](https://min.io/) as a local S3-compatible server:

```bash
mkdir -p ~/minio/data

docker run \
   -p 9000:9000 \
   -p 9001:9001 \
   --user $(id -u):$(id -g) \
   --name minio1 \
   -e "MINIO_ROOT_USER=ROOTUSER" \
   -e "MINIO_ROOT_PASSWORD=CHANGEME123" \
   -v ~/minio/data:/data \
   quay.io/minio/minio server /data --console-address ":9001"
```

Access the MinIO console at http://localhost:9001 (credentials: `ROOTUSER` / `CHANGEME123`). Create a bucket and configure the S3 environment variables to point to `localhost:9000`.

See [Self-Hosting](getting-started/self-hosting.md) for full storage configuration details.
