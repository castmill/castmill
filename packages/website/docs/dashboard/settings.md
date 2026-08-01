---
sidebar_position: 8
---

# Settings

The Settings page lets you manage your account, security credentials, and preferences.

## Profile

Edit your personal information:

- **Full name** — Your display name
- **Email address** — Changing your email triggers a **verification flow**: a confirmation email is sent to the new address, and the change only takes effect after you click the verification link

Click **Save** to apply changes. The button is disabled until you modify a field.

## Security & Authentication

Manage your **passkeys** (WebAuthn credentials) — the cryptographic keys used to log in to Castmill.

### Viewing Passkeys

A list of all registered passkeys is shown, each displaying:

- **Name** — A label you can customize (e.g., "MacBook Pro", "iPhone")
- **Date added** — When the passkey was registered

### Adding a Passkey

1. Click **Add New Passkey**
2. Your browser or device prompts you to create a new credential (fingerprint, Face ID, security key, etc.)
3. Enter a **name** for the passkey
4. The passkey is registered and can be used to log in from that device

:::tip
Register passkeys on multiple devices to ensure you can always access your account. If you lose access to all devices with registered passkeys, you will need to use the [credential recovery](../concepts/authentication.md#credential-recovery) flow.
:::

### Managing Passkeys

- **Rename** — Click the edit button to change a passkey's display name
- **Remove** — Click the delete button to remove a passkey

:::caution
You cannot remove your **last remaining passkey**. At least one passkey must always be registered to maintain account access.
:::

## Language

Choose your preferred **display language** from a grid of supported locales:

| Code | Language |
| ---- | -------- |
| EN   | English  |
| ES   | Español  |
| SV   | Svenska  |
| DE   | Deutsch  |
| FR   | Français |
| ZH   | 中文     |
| AR   | العربية  |
| KO   | 한국어   |
| JA   | 日本語   |

Click a language to switch immediately. The active language is highlighted with a checkmark. Arabic (AR) enables **right-to-left** layout.

## Onboarding Tour

If you want to revisit the **guided walkthrough** that appears for new users:

1. Click **Reset Tour**
2. Confirm in the dialog
3. The onboarding tour restarts on your next page load

## Account Management

:::danger Danger Zone
These actions are irreversible.
:::

### Delete Account

1. Click **Delete Account**
2. Read the warning about data loss and passkey cleanup
3. Confirm deletion

**Important considerations:**

- All your data, credentials, and organization memberships are permanently removed
- If you are the **sole administrator** of an organization, deletion is blocked — you must first transfer admin rights or delete the organization
- The system attempts to clean up passkeys from your devices using the browser's credential management API
