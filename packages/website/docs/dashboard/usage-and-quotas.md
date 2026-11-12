---
sidebar_position: 14
title: Usage and quotas
description: Check how much of your plan your organization uses and what happens when a limit is reached.
---

# Usage and quotas

Every organization has quotas: the maximum number of each kind of resource it can create, plus limits on storage and upload size. Quotas come from the organization's plan, which your network administrator sets. The **Usage** page shows how much of each quota you use.

## The Usage page

Open **Usage** in the sidebar. **Resource Usage** shows one card per resource, with the amount used and the total allowed:

**Media Files**, **Storage**, **Users**, **Devices**, **Playlists**, **Channels**, **Teams**, **Widgets**, **Layouts**, **Feeds**, **Automations**, **Automation rules**, **Tags**, **Tag groups** and **AI agents**.

A card is marked **Approaching limit** at 90% of the quota and **Quota limit reached** at 100%.

The **Widgets** card counts the widget items in your playlists. It has no limit.

## Quota resources

| Resource | What it limits |
| --- | --- |
| Organizations | Number of organizations; not shown on the Usage page |
| Media files | Uploaded images and videos |
| Storage | Total size of media files and copied feed media, in MB |
| Maximum upload size | Size of a single uploaded file, in MB |
| Users | Members of the organization. AI agents don't count. |
| Devices | Registered devices |
| Playlists | Playlists |
| Channels | Channels |
| Channel entries | Scheduled entries in channels |
| Teams | Teams |
| Layouts | Layouts |
| Feeds | Data feeds |
| Automations | Automations |
| Automation rules | Rules across all automations |
| Tags | Tags |
| Tag groups | Tag groups |
| AI agents | AI agents |

## When you reach a limit

When a quota is full, the dashboard disables the matching create or upload button and shows the usage next to it. The server refuses new resources over the limit, also through the API and AI agents.

To continue, delete resources you no longer need, or ask your network administrator for a larger plan or a higher limit.

Uploads larger than the maximum upload size are refused. See [Media](./media.md).

## Where quotas come from

For each resource, Castmill uses the first value it finds:

1. A quota set specifically for your organization.
2. The quota of your organization's plan.
3. The quota of the network's default plan.

If none of them sets a quota, the network's own quotas apply, and without those the limit is 0. Network administrators manage plans and quotas; see [Plans and quotas](/docs/administration/plans-and-quotas).
