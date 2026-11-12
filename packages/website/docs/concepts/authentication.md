---
sidebar_position: 5
title: Authentication
description: How people, devices, AI agents and integrations authenticate with Castmill.
---

# Authentication

Castmill authenticates four kinds of clients, each with its own credential.

| Client | Credential | Lifetime |
| --- | --- | --- |
| People in the dashboard | Passkey, then a signed session token | Session token: 24 hours |
| Root user in the admin tool | Email and password from the server configuration | Browser session |
| Players | Device token issued at registration | Until the device is removed |
| AI agents | Agent secret starting with `cmagt_` | Until revoked |
| Systems that push data to feeds | Feed token starting with `cmfeed_` | Until revoked |

## Passkeys

The dashboard uses passkeys (WebAuthn) instead of passwords. During sign-up the browser creates a key pair. The private key stays on the user's device or in their password manager; the server only stores the public key. To sign in, the browser signs a one-time challenge from the server with the private key, and the server checks the signature.

This has a few consequences:

- There is no password database to leak, and nothing to phish: a passkey only works on the domain it was created for.
- A passkey created for one domain does not work on another. When a network moves to a new domain, users get an email to create a passkey for it.
- Losing every passkey means using account recovery, which sends a link to the account's email address.

Supported signature algorithms are Ed25519, ES256 and RS256, which covers current platform authenticators and security keys.

[First sign-in](../getting-started/first-login.md) describes the steps from a user's point of view.

## Sessions

After a successful passkey check, the server returns a signed session token. The dashboard keeps it in the browser's local storage and sends it as a bearer token with every API request and on the WebSocket connection. Tokens are valid for 24 hours. Because the dashboard does not depend on cookies, it works on any custom domain without third-party cookie restrictions.

## Sign-up and invitations

1. The user enters an email address.
2. The server emails a confirmation link. The address must belong to the user before an account exists.
3. The link opens the dashboard, which creates the passkey and the account.

A user who signs up on their own gets a new organization. A user who signs up from an invitation joins the inviting organization instead. Networks can be set to [invitation only](./networks.md#network-settings), in which case step 1 requires a valid invitation.

## Device authentication

A player that starts for the first time shows a **pincode**. When a user registers the device with that pincode in the dashboard, the server issues the player a device token, which it uses for all later requests. The pincode expires after one hour. Removing the device in the dashboard revokes its token. See [Devices](../dashboard/devices.md).

## Tokens for integrations

- **Agent secrets** give an AI assistant access to one organization through the MCP server, with the permissions of the role chosen for the agent. See [AI agents](../dashboard/ai-agents.md).
- **Feed tokens** allow writing to one feed and nothing else. See [Feeds](../dashboard/feeds.md).

Secrets are shown once, when they are created. Store them in a secret manager and create a new one if a secret is lost.

## Admin tool

The admin tool at `/admin` on the server uses a separate email and password login for the root user, configured with `CASTMILL_ROOT_USER_EMAIL` and `CASTMILL_ROOT_USER_PASSWORD`. Use a long, unique password and restrict access to `/admin` at your reverse proxy if possible. See [Admin tool](../administration/admin-tool.md).
