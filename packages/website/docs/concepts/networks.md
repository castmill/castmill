---
sidebar_position: 2
---

# Networks

A **network** is the top-level organizational boundary in Castmill. It represents a fully isolated environment tied to a specific domain.

## What is a Network?

Think of a network as an independent instance of Castmill. Each network:

- Has its own **domain** (e.g., `signage.company.com`)
- Contains its own set of **organizations**
- Has its own **users**, who may or may not overlap with other networks
- Has independent **configuration** (branding, access controls, default plans)
- Is completely **data-isolated** — no content, devices, or user data crosses network boundaries

## When to Use Multiple Networks

**Single network** (most common):

- One company managing its own digital signage
- A single deployment serving one set of organizations

**Multiple networks**:

- A managed service provider serving different clients, each needing complete isolation
- Different business units requiring separate domains and branding
- Regulatory requirements demanding strict data separation

## Network Properties

| Property            | Description                                                           |
| ------------------- | --------------------------------------------------------------------- |
| **Name**            | Display name for the network                                          |
| **Domain**          | The domain associated with this network (e.g., `signage.company.com`) |
| **Email**           | Contact email for the network                                         |
| **Logo**            | Network branding logo                                                 |
| **Default Plan**    | The plan assigned to new organizations by default                     |
| **Invitation Only** | When enabled, only invited users can create accounts                  |
| **Social Links**    | Optional links to social media profiles                               |

## Network Administration

Network administrators have access to a dedicated section in the dashboard sidebar with:

- **Overview** — Aggregate statistics across all organizations (devices, users, storage, etc.)
- **Settings** — Network identity, domain configuration, access controls
- **Organizations** — Create, manage, block, or remove organizations
- **Users** — Invite users, manage access, block accounts

Network administration is accessed via the **Network** section in the dashboard sidebar (visible only to network admins).

## Domain Resolution

When a user accesses the Castmill dashboard, the server determines which network to use based on the request's **origin domain**:

```
https://signage.company.com  →  Network "Company Signage"
https://agency.castmill.com  →  Network "Agency Network"
```

This happens transparently. Users only see the content and organizations belonging to their network.

## Access Control

Network administrators can configure:

- **Invitation-only mode** — Restricts sign-up. Only users who receive an invitation email can create accounts.
- **User blocking** — Administrators can block individual users, preventing them from accessing the network.
- **Organization blocking** — Entire organizations can be blocked if needed.

## Custom Domains

Networks can be accessed via custom domains. When a custom domain is configured:

1. DNS is pointed to the Castmill platform
2. TLS/SSL certificates are automatically provisioned
3. The dashboard is accessible at the custom domain
4. Users create passkeys bound to the custom domain

Custom domain setup is managed through the network administration interface or via commercial addons.
