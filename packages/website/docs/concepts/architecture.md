---
sidebar_position: 1
---

# Architecture

Castmill is a multi-tenant digital signage platform built around a clear hierarchy of resources. Understanding this hierarchy is key to using the system effectively.

## The Resource Hierarchy

```mermaid
graph TD
    N[Network] --> O1[Organization A]
    N --> O2[Organization B]
    N --> O3[Organization C]
    O1 --> T1[Teams]
    O1 --> U1[Users]
    O1 --> M1[Media]
    O1 --> P1[Playlists]
    O1 --> C1[Channels]
    O1 --> D1[Devices]
    O1 --> L1[Layouts]
    O1 --> W1[Widgets]
    P1 --> PI1[Playlist Items<br/>Widget Instances]
    C1 --> CE1[Calendar Entries<br/>Scheduled Playlists]
    D1 -.->|assigned| C1
```

### Network

The **network** is the top-level boundary. Each network:

- Is tied to a **domain** (e.g., `signage.company.com`)
- Acts as a **complete data silo** — no data crosses network boundaries
- Has its own set of organizations, users, and configuration
- Can be managed by network administrators

Most deployments use a single network. Multiple networks are used when you need fully isolated environments (e.g., different clients on a SaaS platform).

→ [Learn more about Networks](./networks.md)

### Organization

**Organizations** are the working spaces within a network. Each organization:

- Contains all content resources (media, playlists, channels, devices, layouts, widgets)
- Has its own **users and teams** with role-based permissions
- Has a **plan** that determines quotas (how many devices, media files, etc.)
- Operates independently from other organizations in the same network

Users can belong to multiple organizations and switch between them in the dashboard.

→ [Learn more about Organizations](./organizations.md)

### Resources

Within an organization, the main resources are:

| Resource      | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| **Media**     | Images and videos uploaded for use in playlists                |
| **Playlists** | Ordered sequences of widgets with content and timing           |
| **Channels**  | Time-based schedules that assign playlists to time slots       |
| **Devices**   | Physical display screens registered to the organization        |
| **Layouts**   | Multi-zone screen arrangements for complex displays            |
| **Widgets**   | Reusable content components (image, video, weather, web, etc.) |
| **Teams**     | Groups of users with shared permissions                        |

## Content Flow

Understanding how content reaches a display device:

```mermaid
flowchart LR
    M[Media Files] --> P[Playlist]
    W[Widgets] --> P
    P --> C[Channel]
    C --> D[Device]

    style M fill:#4ade80,color:#000
    style W fill:#60a5fa,color:#000
    style P fill:#c084fc,color:#000
    style C fill:#f59e0b,color:#000
    style D fill:#f87171,color:#000
```

1. **Upload media** — Images, videos, and other files are uploaded to the organization
2. **Build playlists** — Combine media and widgets into ordered playlists with timing
3. **Schedule channels** — Assign playlists to time slots on a weekly calendar
4. **Assign to devices** — Connect channels to physical display devices
5. **Devices play content** — Devices pull their schedule and play the right content at the right time

## System Components

```mermaid
graph TB
    subgraph "Client Side"
        Dashboard[Dashboard<br/>SolidJS SPA]
        Player[Device Player<br/>Web Application]
    end

    subgraph "Server"
        Phoenix[Phoenix Server<br/>REST API + WebSocket]
        Addons[Addon System<br/>Extensible Modules]
    end

    subgraph "Storage"
        DB[(PostgreSQL)]
        S3[Object Storage<br/>S3 / R2]
    end

    Dashboard -->|Bearer Token Auth| Phoenix
    Player -->|WebSocket| Phoenix
    Phoenix --> DB
    Phoenix --> S3
    Addons --> Phoenix
```

### Dashboard

The management interface is a **SolidJS single-page application**. It communicates with the server via REST API calls authenticated with Bearer tokens. The dashboard supports 9 languages and uses passkey-based authentication.

### Server

The **Elixir/Phoenix server** handles all business logic, authentication, asset management, and real-time communication with devices via WebSocket channels.

### Addon System

Castmill features a modular **addon system**. Core features (playlists, media, devices, channels, layouts, widgets) are implemented as addons, and the system is extensible with third-party addons for billing, custom domains, and other features.

### Player

The **device player** is a web application that runs on display devices. It connects to the server via WebSocket, receives its schedule and content, caches media locally, and renders playlists on screen.

## Multi-Tenancy Model

Castmill uses a network-based multi-tenancy model:

```
┌─────────────────────────────────────────┐
│              Castmill Instance           │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │  Network A   │  │  Network B   │      │
│  │ company.com  │  │ agency.com   │      │
│  │             │  │             │      │
│  │  Org 1      │  │  Org X      │      │
│  │  Org 2      │  │  Org Y      │      │
│  │  Org 3      │  │             │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  Data is completely isolated between    │
│  networks. Organizations within a       │
│  network share nothing by default.      │
└─────────────────────────────────────────┘
```

Each network resolves from a domain. When you access `company.com`, the server identifies the corresponding network and scopes all operations to it.
