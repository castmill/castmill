---
sidebar_position: 2
title: Networks
description: Networks are the top-level tenants in Castmill, each with its own domain, branding, sign-up rules and plans.
---

# Networks

A **network** is a complete Castmill service as its users see it: a dashboard on its own domain, with its own name, logo, sign-up rules and plans. Every organization, user membership and invitation belongs to one network.

One Castmill server can host many networks. Typical setups:

- **One network** for a company that runs its own signage.
- **One network per customer** for a reseller or agency that offers Castmill under each customer's brand.
- **Separate networks** for staging and production on the same server.

## How a network is selected

The dashboard sends its own address with every sign-in and sign-up request. The server looks up the network whose **domain** matches that address. A dashboard served from `signage.example.com` therefore belongs to the network with the domain `signage.example.com`. Domains are stored without `http://` or `https://`, and include the port when it is not the default, for example `localhost:3000`.

The same domain list also controls which websites may call the API from a browser (CORS). A dashboard on a domain that no network knows about cannot sign in.

## Network settings

| Setting | Purpose |
| --- | --- |
| Name, email | How the network identifies itself, for example in emails |
| Domain | The dashboard address that selects this network |
| Logo, copyright, privacy policy URL | Branding shown in the dashboard and emails |
| Default language | Language for users who have not chosen one |
| Default plan | [Plan](../administration/plans-and-quotas.md) given to new organizations |
| Invitation only | When enabled, people can only create an account from an invitation. Enabled by default for new networks. |
| Organization admins may invite | Stored as a network setting, but currently has no effect: organization admins can invite people regardless of this setting. |

## Who manages a network

**Network administrators** manage a network from the **Network** section of the dashboard sidebar: settings, organizations, users, invitations and which widgets are available. See [Network administration](../administration/network-administration.md).

The **root user** of the server manages all networks from the [admin tool](../administration/admin-tool.md). The admin tool is where you create the first network and appoint its first network administrators.

## Isolation

Networks share the server, the database and the media storage, but the dashboard and API only ever show data from the network that matches the dashboard's domain. Each organization belongs to exactly one network.
