---
sidebar_position: 2
title: First sign-in
description: Create a Castmill account with a passkey, sign in, and recover access if you lose your passkeys.
---

# First sign-in

The Castmill dashboard has no passwords. You sign in with a **passkey**, a credential stored by your device or password manager and unlocked with your fingerprint, face, PIN or security key. Passkeys cannot be phished or reused on another site.

Any current browser supports passkeys, including Chrome, Edge, Safari and Firefox. A passkey can live in:

- Touch ID or Face ID on macOS and iOS (synced through iCloud Keychain)
- Windows Hello
- Google Password Manager on Android and Chrome
- A password manager that supports passkeys
- A hardware security key (USB or NFC)

## Create an account

1. Open the dashboard address you were given, or http://localhost:3000 for a [local installation](./quick-start.md).
2. Choose **Sign up** and enter your email address.
3. Open the email from Castmill and follow the link. The link only works for a limited time.
4. Choose **Continue with Passkey** and confirm the prompt from your browser or device.

Castmill creates your account and an organization in which you are an administrator, then signs you in.

If you were invited to an existing organization, follow the link in the invitation email instead. You join that organization with the role chosen by the person who invited you, and no new organization is created.

:::note Invitation-only networks
A network administrator can require an invitation for every new account. In that case the login page shows *This service requires an invitation to register*, and you need an invitation email to sign up.
:::

## Sign in

1. Open the dashboard.
2. Enter your email address and choose **Login with Passkey**.
3. Confirm the prompt from your browser or device.

A session lasts 24 hours. After that, the dashboard asks you to sign in again.

## Add more passkeys

Register a passkey on each device you use, so that losing one device does not lock you out.

1. Open **Settings** from the sidebar.
2. Under **Passkeys**, choose **Add New Passkey**.
3. Confirm the prompt on the new device or browser.

You can rename passkeys to recognize them later, for example "Work laptop". You can delete a passkey as long as at least one remains.

## Recover access

If you lose all your passkeys:

1. On the login page, choose **Lost your credentials?**.
2. Enter your email address.
3. Follow the link in the recovery email and create a new passkey.

## Custom domains

Passkeys belong to a single domain. A passkey created on `app.example.com` does not work on `signage.example.com`. When a network moves to a new domain, users receive an email with a link that creates a passkey for the new domain. After that, they can sign in on both.

## Next steps

- Take the in-app tour from the **Getting Started** button in the top bar, or read the [dashboard overview](../dashboard/overview.md).
- Put content on a screen with [Your first screen](./first-screen.md).
