---
sidebar_position: 4
title: Network administration
description: Manage branding, sign-up, organizations, users and widget access for a whole network from the dashboard.
---

# Network administration

Network administrators manage a whole [network](../concepts/networks.md) from the dashboard. They see an extra **Network** section in the sidebar. To become one, ask the operator of the installation to add you in the [admin tool](./admin-tool.md#network-administrators).

Network administration is separate from organization roles. To work on an organization's playlists or devices, you need a role in that organization like anyone else.

## Overview

**Network → Overview** shows the number of organizations, users, devices and teams in the network, the total storage used, and the network details.

## Settings

**Network → Settings** has these groups:

| Group | Settings |
| --- | --- |
| **Network Identity** | **Network Name**, **Support Email**, **Logo URL**, **Copyright Text**, **Privacy Policy URL** (shown on the sign-in and sign-up pages) and **Default Language** for new users and the sign-in page |
| **Social Links** | GitHub, X, LinkedIn and Facebook addresses for the dashboard footer |
| **Domain Configuration** | The network domain. It is read-only here; the installation operator changes it in the admin tool. |
| **Access Control** | **Invitation Only**: when on, people can only join through an invitation and public sign-up is disabled. |

## Organizations

**Network → Organizations** lists every organization in the network. From here you can:

- **Create Organization**. Then invite its first administrator from **Users & Invitations**.
- **Block** an organization. Its users can no longer sign in until you **Unblock** it. Network administrators are never locked out this way.
- Delete an organization with all its content. This cannot be undone.
- Edit **Integration settings**: values that network-level widgets need per organization, for example an office ID. Only network administrators can change them.

## Users and invitations

**Network → Users & Invitations** lists every user and every pending invitation.

- **Invite User** sends an invitation to join a chosen organization as **Administrator** or **Member**. This is how people join an invitation-only network.
- **Block** a user to stop them from signing in, optionally with a reason. **Unblock** restores access. You cannot block yourself or another network administrator.
- Delete a user permanently.
- Delete pending invitations.

## Widget access

**Network → Widget Access** controls which widgets the organizations in the network can use. Select a widget, then choose who can use it:

| Access | Meaning |
| --- | --- |
| **All organizations** | Every organization, including ones created later |
| **All except…** | Every organization except the ones you exclude. New organizations get the widget. |
| **Only selected…** | Only the organizations you add. New organizations do not get the widget. |
| **Hidden** | No organization can add the widget to playlists |

Core widgets, such as image and video, are always available, because playlists and media depend on them. You cannot remove access from an organization that uses the widget in a playlist; remove it from those playlists first. The list shows how many organizations use each widget.

Widgets are either **System** widgets, which come with Castmill, or **Network** widgets, which were added for this network only. See [Widget scopes](../developers/widgets/overview.mdx) for how widgets are installed.

## Plans and quotas

Each organization has limits on how many resources it can create. Plans are managed by the installation operator. See [Plans and quotas](./plans-and-quotas.md).
