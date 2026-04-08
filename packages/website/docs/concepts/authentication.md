---
sidebar_position: 5
---

# Authentication

Castmill uses **passkey-based authentication** exclusively. There are no passwords anywhere in the system.

## What are Passkeys?

Passkeys are a modern authentication standard (WebAuthn/FIDO2) that replaces passwords with cryptographic key pairs stored on your device. They're:

- **Phishing-resistant** — Passkeys are bound to a specific domain and can't be tricked into authenticating on fake sites
- **Convenient** — Authenticate with Touch ID, Face ID, Windows Hello, or a PIN
- **Secure** — Private keys never leave your device; only a signed proof is sent to the server

## How Authentication Works

### Signup Flow

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant S as Server

    U->>B: Enter email
    B->>S: POST /signups
    S->>U: Verification email
    U->>B: Click email link
    B->>B: Create passkey (WebAuthn)
    B->>S: POST /signups/:id/users (credential)
    S->>S: Store public key
    S-->>B: Account created
```

1. User enters their email and clicks **Continue**
2. Server sends a verification email
3. User clicks the link, browser prompts to create a passkey
4. Browser registers the passkey and sends the public key to the server
5. Account is created

### Login Flow

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant S as Server

    U->>B: Click "Login with Passkey"
    B->>S: POST /sessions/challenges
    S-->>B: Challenge + token
    B->>B: Sign challenge with passkey
    B->>S: POST /sessions (signed assertion)
    S->>S: Verify signature
    S-->>B: JWT token
    B->>B: Store token in localStorage
```

1. User clicks **Login with Passkey**
2. Server generates a cryptographic challenge
3. Browser signs the challenge using the stored passkey
4. Server verifies the signature and returns a Bearer token
5. Token is stored in `localStorage` and used for all subsequent API calls

### Token-Based Sessions

After login, all API requests include the token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Tokens expire after 24 hours, requiring re-authentication.

## Credential Recovery

If you lose access to your passkey (e.g., device lost or reset):

1. Click **Recover access** on the login page
2. Enter your email address
3. Check your email for a recovery link
4. Click the link to create a new passkey
5. The new passkey replaces your previous credentials

## Managing Multiple Passkeys

You can register passkeys on multiple devices for redundancy:

1. Go to **Settings** > **Security & Authentication**
2. Click **Add New Passkey**
3. Follow the browser prompt to register

Each passkey is listed with its name and creation date. You can rename or delete passkeys (you must keep at least one).

:::tip
Register a passkey on at least two devices — for example, your laptop and your phone — so you always have a backup way to log in.
:::

## Domain-Bound Passkeys

Passkeys are **bound to the domain** where they were created. If your network uses a custom domain:

- A passkey created on `app.castmill.com` won't work on `signage.company.com`
- When a custom domain is configured, you'll receive an email to set up a domain-specific passkey
- After setup, you can log in from the custom domain

## Supported Algorithms

Castmill supports these WebAuthn signature algorithms:

- **Ed25519** (EdDSA) — Preferred
- **ES256** (ECDSA with P-256)
- **RS256** (RSA with SHA-256)

Your browser and device determine which algorithm is used. All three provide strong cryptographic security.

## Security Considerations

- **No password databases** — There are no passwords to steal or leak
- **No session cookies** — Authentication uses Bearer tokens, avoiding third-party cookie issues
- **Cross-domain support** — Custom domains work via domain-specific passkeys
- **Invitation-only option** — Networks can restrict registration to invitations only
