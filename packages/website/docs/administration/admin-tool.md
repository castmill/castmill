---
sidebar_position: 3
title: Admin tool
description: Use the server's built-in admin tool to create networks, appoint network administrators and inspect data across the installation.
---

# Admin tool

The admin tool is a separate web interface served by the Castmill server at `/admin`, for example `https://api.example.com/admin`. It is meant for the operator of the installation. It works across all networks, while the dashboard always works inside one network.

## Sign in

The admin tool signs in the root user with an admin passkey. Admin passkeys are separate from the passkeys you use in the dashboard.

The root user is created by the first database migration from `CASTMILL_ROOT_USER_EMAIL` and `CASTMILL_ROOT_USER_PASSWORD`; changing the variables later does not change the account.

1. The first time, enter the root user's **Email** and **Password** and choose **Set up first passkey**. Register the passkey within five minutes; until then, the password gives no access.
2. After that, choose **Sign in with a passkey**. Select **Keep me signed in** to stay signed in on this computer.

Once a passkey is registered, the password no longer signs you in. Register a backup passkey on another device under **Admin passkeys** in the sidebar. You cannot remove the last one.

<Screenshot src="admin-tool-sign-in" alt="The admin tool sign-in page with Sign in with a passkey and the root credentials for setting up the first passkey" />

If all admin passkeys are lost, an operator with access to a release console of the server (for example `bin/castmill remote`) can remove them, so that the root credentials can set up a new one:

```elixir
user = Castmill.Accounts.get_user_by_email("root@example.com")
Castmill.Accounts.AdminPasskeys.reset(user.id)
```

:::warning
The root user has full access to every network. Use a strong password, keep a backup passkey, and consider making `/admin` reachable only from your internal network or VPN at the reverse proxy.
:::

## Sections

The sidebar lists **Networks**, **Organizations**, **Teams**, **Users**, **Devices**, **Channels**, **Playlists**, **Medias** and **Admin passkeys**. Each section is a searchable table. Open a row to see its details and related records.

## Networks

A [network](../concepts/networks.md) is the top level of an installation: one dashboard domain with its own users, organizations, plans and branding. Most installations have one network.

To create a network, open **Networks** and create a new one:

| Field | Description |
| --- | --- |
| **Name** | Shown in the dashboard and in emails. |
| **Email** | Support address shown to users. |
| **Domain** | Host name of the dashboard, without `https://`, for example `app.example.com`. Include the port if it is not the default, for example `localhost:3000`. |
| **Logo**, **Copyright** | Branding shown in the dashboard. |
| **Invitation Only Mode** | When on, people can only join by invitation. New networks have it on. |

Creating a network also creates a **Default Plan** with default quotas and makes it the network's default. See [Plans and quotas](./plans-and-quotas.md).

Open a network to see its **Organizations**, **Invitations**, **Teams**, **Users**, **Admins**, **Devices**, **Channels**, **Playlists**, **Medias**, **Widgets** and **Integrations**.

## Network administrators

Network administrators manage a network from the dashboard; see [Network administration](./network-administration.md). To appoint one:

1. Ask the person to sign up in the dashboard first. Only existing users can become network administrators.
2. Open the network and select the **Admins** tab.
3. Add the person's email address.

The next time the person loads the dashboard, the **Network** section appears in the sidebar.

## Organizations

You can create organizations in a network and invite their first administrator from the network's **Organizations** and **Invitations** tabs. Network administrators can do the same from the dashboard, which is usually more convenient.

## Integrations

The **Integrations** tab of a network holds network-wide credentials for widget integrations, for example an API key that all organizations share. Credentials are encrypted with `ENCRYPTION_MASTER_KEY`. See [Widgets](../dashboard/widgets.md).
