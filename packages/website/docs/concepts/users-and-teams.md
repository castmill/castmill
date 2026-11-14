---
sidebar_position: 4
title: Users, roles and teams
description: Organization roles and what each one may do, team roles, invitations and how teams group resources.
---

# Users, roles and teams

A user is a person with a Castmill account. A user can belong to several organizations and has a **role** in each one. The role decides what the user may do in that organization. **Teams** group users and resources inside an organization.

## Organization roles

Castmill has seven organization roles. Pick the one with the least access that still lets a person do their work.

| Role | Intended for |
| --- | --- |
| **Admin** | Owners of the organization. Full access, including members, invitations and organization settings. |
| **Manager** | Team leads. Full access to content, scheduling, devices and teams, but cannot change the organization itself or its members. |
| **Member** | Content creators. Create and edit media, playlists, layouts and feeds; view and adjust channels and devices. The default role for invitations. |
| **Editor** | Content creators who also maintain widgets. Like Member, plus uploading and editing widgets; devices are read-only. |
| **Publisher** | Editors who may also publish playlists and channels. |
| **Device manager** | Installers and operations staff. Full control of devices, channels and automations; content is read-only. |
| **Guest** | Stakeholders who only need to look. Read-only access everywhere. |

### Permission matrix

**Full** means list, view, create, edit and delete. **Edit** means list, view and edit existing items. **View** means list and view only.

| Resource | Admin | Manager | Member | Editor | Publisher | Device manager | Guest |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Media | Full | Full | Full | Full | Full | View | View |
| Playlists | Full + publish | Full + publish | Full | Full | Full + publish | View | View |
| Layouts | Full | Full | Full | Full | Full | View | View |
| Widgets | Full | Full | View | Full | Full | View | View |
| Feeds | Full | Full | Full | Full | Full | View | View |
| Channels | Full + publish | Full + publish | Edit | Edit | Edit + publish | Full + publish | View |
| Devices | Full | Full | Edit | View | View | Full | View |
| Automations | Full | Full | Edit | Edit | Edit | Full | View |
| Teams | Full | Full | View | View | View | View | View |
| Organization (members, invitations, settings) | Full | View | View | View | View | View | View |

Some pages have extra rules on top of the matrix:

- **Agents** (AI assistants) can only be managed by admins and managers.
- Network pages are only shown to [network administrators](../administration/network-administration.md).

The server enforces every permission. The dashboard also hides actions you cannot perform, so two users can see different buttons on the same page.

## Invite people

Admins invite people from **Organization → Users**:

1. Choose **Invite Member**.
2. Enter the email address and choose a role.
3. Choose **Add**.

<Screenshot src="organization-invite" alt="The Invite Member dialog with an email address and the Member role" width={592} />

The person receives an email with a link. If they do not have an account yet, they create one with a passkey as part of accepting the invitation. Pending invitations are listed on **Organization → Invitations** until they are accepted or removed.

To change a member's role or remove a member, use **Organization → Users**. An organization must always keep at least one admin, and its only member cannot leave it.

<Screenshot src="organization-members" alt="The Users tab of an organization with five members and their roles" />

## Teams

A team is a named group of users inside an organization, for example *Store staff Stockholm* or *Marketing*. Use teams to:

- **Group people** who work together.
- **Group resources.** Media, playlists, channels and devices can be added to a team, and every list in the dashboard can be filtered by team.
- **Invite people for a specific job.** Team invitations carry a team role, including a short-lived installer role.

### Team roles

| Team role | Can do |
| --- | --- |
| **Team admin** | Manage the team's members and invitations. |
| **Team member** | Work with the team's resources according to their organization role. |
| **Installer (24h)** | Register devices, and nothing else. The invitation expires after 24 hours. |

The installer role is meant for technicians who mount screens on site: they can register the new devices without getting access to content or other devices.

See [Teams](../dashboard/teams.md) for how to create teams, invite members and add resources.

## Network administrators

A network administrator manages the network as a whole: its settings, all organizations, users and widget availability. This is separate from organization roles. See [Network administration](../administration/network-administration.md).
