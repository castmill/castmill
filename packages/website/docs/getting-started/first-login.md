---
sidebar_position: 2
---

# First Login

Castmill uses **passkey-based authentication** instead of traditional passwords. Passkeys are a modern, phishing-resistant authentication method built into your browser and operating system.

## Creating Your Account

### Step 1: Navigate to the Dashboard

Open the Castmill dashboard in your browser. The URL depends on your deployment — for a local setup it's `http://localhost:3000`.

<!-- TODO: Screenshot — Login page showing the email input and "Login with Passkey" button -->

### Step 2: Enter Your Email

Type your email address in the signup field and click **Continue**. Castmill will send a verification email to that address.

<!-- TODO: Screenshot — Signup form with email entered -->

:::note
If the network is configured as **invitation-only**, you won't see the signup form. Instead, you'll see a notice that registration requires an invitation from a network administrator.
:::

### Step 3: Check Your Email

Open the verification email and click the link. This takes you back to Castmill to complete your registration.

<!-- TODO: Screenshot — Verification email example -->

### Step 4: Create Your Passkey

Your browser will prompt you to create a passkey. Depending on your device, this may use:

- **Touch ID / Face ID** on macOS and iOS
- **Windows Hello** on Windows
- **PIN or biometric** on Android
- **Security key** (USB/NFC) on any platform

<!-- TODO: Screenshot — Browser passkey creation dialog -->

Follow the browser prompt to register your passkey. Once complete, your account is created and you can log in.

## Logging In

After your account is created:

1. Navigate to the dashboard
2. Click **Login with Passkey**
3. Your browser prompts you to authenticate with your passkey
4. You're logged in — no password to remember

<!-- TODO: Screenshot — Login with Passkey button -->

## Managing Your Passkeys

You can manage your passkeys from the **Settings** page:

1. Click the **Settings** gear icon in the sidebar
2. Under **Security & Authentication**, you'll see your registered passkeys
3. You can:
   - **Rename** a passkey for easier identification
   - **Add a new passkey** (e.g., register on a second device)
   - **Delete** a passkey (disabled if it's your only one)

<!-- TODO: Screenshot — Settings page showing passkey management section -->

:::tip
Register passkeys on multiple devices so you can always log in, even if one device is unavailable.
:::

## Recovering Access

If you lose access to all your passkeys:

1. On the login page, click **Recover access**
2. Enter your email address
3. Check your email for a recovery link
4. Click the link and create a new passkey

The recovery passkey replaces your previous credentials and logs you in immediately.

## Invitation-Only Networks

Network administrators can restrict registration to invitation-only. In this mode:

1. An admin sends you an invitation email with a registration link
2. Click the link to create your account and passkey
3. You'll be added to the specified organization automatically

## Custom Domain Passkey Setup

When a network administrator sets up a custom domain (e.g., `signage.company.com`), existing users may receive an email to register a passkey for the new domain. This is because passkeys are domain-bound — a passkey created for `app.castmill.com` won't work on `signage.company.com`.

Click the link in the email to create a domain-specific passkey. After setup, you can log in from either domain.
