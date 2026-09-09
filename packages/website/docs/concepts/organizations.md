---
sidebar_position: 3
---

# Organizations

An **organization** is a working space within a network where users collaborate on digital signage content.

## What is an Organization?

Organizations are the primary unit of collaboration in Castmill. Each organization has its own:

- **Content** — Media files, playlists, channels, layouts, and widgets
- **Devices** — Display screens registered to the organization
- **Users** — Members with assigned roles and permissions
- **Teams** — Groups for organizing users and controlling resource access
- **Plan and quotas** — Limits on resources (devices, storage, media files, etc.)

## Creating an Organization

Organizations can be created in two ways:

1. **By a network admin** — Through the Network > Organizations page
2. **Automatically** — When a new user signs up, they may be placed in a default organization

## Plans and Quotas

Each organization is assigned a **plan** that defines resource quotas:

| Resource      | Description                            |
| ------------- | -------------------------------------- |
| **Devices**   | Maximum number of registered devices   |
| **Media**     | Maximum number of uploaded media files |
| **Storage**   | Maximum total storage (in MB)          |
| **Users**     | Maximum number of organization members |
| **Teams**     | Maximum number of teams                |
| **Playlists** | Maximum number of playlists            |
| **Channels**  | Maximum number of channels             |
| **Layouts**   | Maximum number of layouts              |
| **Widgets**   | Maximum number of custom widgets       |

Quotas are enforced when creating new resources. If a quota is reached, users must delete existing resources or upgrade their plan before creating new ones.

The **Usage** page in the dashboard shows current consumption against each quota.

→ See [Usage & Quotas](../dashboard/usage-and-quotas.md) for details.

## Switching Between Organizations

Users who belong to multiple organizations can switch between them using the **organization selector** at the top of the sidebar. Switching organizations changes the entire dashboard context — all content, devices, and settings reflect the selected organization.

<!-- TODO: Screenshot — Organization selector dropdown in the sidebar -->

## Organization Settings

Organization administrators can manage:

- **Name** — The organization's display name
- **Logo** — Upload a custom logo for branding
- **Members** — View and manage organization users
- **Invitations** — Send invitations to new members

→ See [Dashboard: Settings](../dashboard/settings.md) for details.

## Users Within an Organization

Each user in an organization has a **role** that determines their permissions:

| Role       | Capabilities                                                            |
| ---------- | ----------------------------------------------------------------------- |
| **Admin**  | Full access: manage users, settings, all content and devices            |
| **Member** | Create and manage content, register devices (based on team permissions) |
| **Viewer** | Read-only access to content and devices                                 |

Permissions can be further refined through **teams**, which control access to specific resources.

→ See [Users & Teams](./users-and-teams.md) for details on roles and permissions.

## Tags

Resources within an organization can be tagged for easier organization and filtering. Tags are grouped into **tag groups** and can be applied to media, playlists, channels, devices, and layouts.

Tags enable:

- Quick filtering in any resource list
- Hierarchical organization via the tree view
- Bulk operations on tagged resources
