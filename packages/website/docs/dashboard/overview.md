---
sidebar_position: 1
---

# Dashboard Overview

The Castmill Dashboard is a web-based management interface built with [SolidJS](https://www.solidjs.com/). It is the primary tool for managing your digital signage content, devices, and schedules.

## Sidebar Navigation

The sidebar is the main way to navigate the dashboard. It is organized into sections:

### Organization Selector

At the top of the sidebar, a dropdown lets you switch between organizations you belong to. Selecting an organization updates the URL and all pages to reflect that organization's data.

### Main Sections

| Section               | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| **Organization**      | View and manage the current organization's details, members, and invitations |
| **Content**           | Parent section for all content types (expandable)                            |
| &nbsp;&nbsp;Medias    | Upload and manage images and videos                                          |
| &nbsp;&nbsp;Playlists | Create ordered sequences of widgets                                          |
| &nbsp;&nbsp;Layouts   | Design multi-zone screen arrangements                                        |
| &nbsp;&nbsp;Widgets   | Browse and manage installed widgets                                          |
| **Devices**           | Register and manage physical display devices                                 |
| **Channels**          | Schedule playlists on a weekly calendar                                      |
| **Teams**             | Create teams and manage permissions                                          |
| **Tags**              | Organize resources with color-coded tags                                     |
| **Usage**             | Monitor resource consumption and quotas                                      |
| **Settings**          | User preferences, passkeys, and language                                     |

### Addon Sections

The sidebar supports **dynamic addon entries** loaded from the backend. Addons can inject themselves into predefined mount points in the sidebar hierarchy. For example, a billing addon might appear at the bottom of the sidebar.

### Network Admin

If you are a **network administrator**, an additional section appears below the main navigation with links to:

- **Network** — Network-wide settings and configuration
- **Organizations** — Manage all organizations in the network
- **Users** — Manage all users in the network

## URL Routing

Every page in the dashboard includes the organization ID in the URL:

```
/org/:orgId/content/playlists
/org/:orgId/channels
/org/:orgId/settings
```

This means you can bookmark or share links to specific pages, and the correct organization context is always preserved.

## Keyboard Shortcuts

Most resource pages support keyboard shortcuts for common actions:

| Shortcut   | Action                    |
| ---------- | ------------------------- |
| **Ctrl+N** | Create new resource       |
| **Ctrl+F** | Focus search input        |
| **Delete** | Delete selected resources |

## Global Search

A search function lets you find resources across all types — medias, playlists, channels, devices, and teams. Results are grouped by type, and clicking a result navigates directly to that resource.

## View Modes

Resource pages (medias, playlists, channels, devices) support two view modes:

- **Table view** — Traditional list with sortable columns
- **Tree view** — Resources organized by tag hierarchy (groups → tags → items)

You can toggle between views using the view mode button in the toolbar.

## Filtering

Every resource page provides two types of filters:

- **Team filter** — Show only resources owned by a specific team
- **Tag filter** — Filter by one or more tags, with **any** (match at least one) or **all** (match every selected tag) mode

## Bulk Operations

Select multiple resources using checkboxes, then perform bulk actions:

- **Bulk delete** — Remove all selected resources
- **Bulk tag** — Apply or remove tags from all selected resources

## Deep Linking

Resource pages support the `?itemId=` URL parameter. When present, the dashboard automatically opens the detail view for that resource. This is used by the global search feature and can be bookmarked.
