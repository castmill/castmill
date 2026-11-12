---
sidebar_position: 1
title: Quick start
description: Run Castmill on your computer with Docker Compose and sign in to the dashboard.
---

# Quick start

This guide starts a complete Castmill installation on your computer with Docker Compose: a PostgreSQL database, the Castmill server and the dashboard. It takes about 15 minutes, most of which is spent building the images the first time.

The setup is meant for evaluation and development. For a public server, follow [Self-hosting](../administration/self-hosting.md) afterwards.

## Requirements

- [Docker](https://docs.docker.com/get-docker/) with the Compose plugin (`docker compose version` should print v2 or later)
- [Git](https://git-scm.com/)
- 4 GB of free memory for the image build
- Free ports 3000 (dashboard), 4000 (server), 5432 (database) and 8025 (test mailbox)

## 1. Get the source code

```bash
git clone https://github.com/castmill/castmill.git
cd castmill
```

## 2. Create the environment file

Docker Compose reads settings from a `.env` file next to `docker-compose.yaml`. Create it with the following content:

```bash title=".env"
# Database connection used by the server
DATABASE_URL=ecto://postgres:postgres@db/castmill_dev

# Secrets (replace the placeholders, see below)
SECRET_KEY_BASE=replace-me
ENCRYPTION_MASTER_KEY=replace-me
CASTMILL_DASHBOARD_USER_SALT=replace-me

# Account for the admin tool at http://localhost:4000/admin
CASTMILL_ROOT_USER_EMAIL=admin@example.com
CASTMILL_ROOT_USER_PASSWORD=choose-a-password

# Public address of uploaded media, as seen by browsers and players
MEDIA_PUBLIC_BASE_URL=http://localhost:4000

# Not used locally, but the server expects a value
AWS_ACCESS_KEY_ID=unused
AWS_SECRET_ACCESS_KEY=unused
MAILGUN_API_KEY=unused
```

Generate the three secrets and paste them into the file:

```bash
openssl rand -base64 48   # SECRET_KEY_BASE
openssl rand -base64 32   # ENCRYPTION_MASTER_KEY
openssl rand -hex 16      # CASTMILL_DASHBOARD_USER_SALT
```

`ENCRYPTION_MASTER_KEY` protects stored integration credentials such as API keys and OAuth tokens. Keep a copy: if you lose it, those credentials cannot be decrypted. The [configuration reference](../administration/configuration.md) describes every variable.

## 3. Add a test mailbox

New users confirm their email address before they create a passkey, so the server must be able to send mail. For local use, add [Mailpit](https://mailpit.axllent.org/), which accepts all mail and shows it in a web page. Create `docker-compose.override.yaml` next to `docker-compose.yaml`:

```yaml title="docker-compose.override.yaml"
services:
  mailpit:
    image: axllent/mailpit
    ports:
      - '8025:8025'

  backend:
    environment:
      SMTP_HOST: mailpit
      SMTP_PORT: '1025'
      MAILER_FROM: castmill@example.com
```

Docker Compose merges this file into the main one automatically.

## 4. Start the services

```bash
docker compose up --build
```

The first build compiles the server, the dashboard and the players, so it takes several minutes. The server runs its database migrations on every start. When the log shows `Running CastmillWeb.Endpoint`, the services are ready:

| Service | Address | Purpose |
| --- | --- | --- |
| Dashboard | http://localhost:3000 | Web interface for users |
| Server | http://localhost:4000 | API, admin tool, players and media files |
| Mailpit | http://localhost:8025 | Test mailbox |
| PostgreSQL | `localhost:5432` | Database, also used for background jobs |

Check that the server responds:

```bash
curl http://localhost:4000/api/health
# {"status":"ok"}
```

## 5. Create a network

A [network](../concepts/networks.md) is the top-level tenant in Castmill. The dashboard only accepts sign-ups for a domain that belongs to a network, so create one first.

1. Open the admin tool at http://localhost:4000/admin and sign in with `CASTMILL_ROOT_USER_EMAIL` and `CASTMILL_ROOT_USER_PASSWORD`.
2. Open **Networks** and create a network.
3. Enter a name and email, and set **Domain** to `localhost:3000`. The domain must match the address of the dashboard, including the port and without `http://`.
4. Clear **Invitation Only Mode**. New networks only accept invited users, and you have nobody to invite you yet.
5. Save.

## 6. Create your account

1. Open the dashboard at http://localhost:3000 and choose **Sign up**.
2. Enter your email address.
3. Open Mailpit at http://localhost:8025, open the Castmill email and follow the link.
4. Create a passkey when the browser asks for one.

You are now signed in to a new organization in which you are an administrator. [First sign-in](./first-login.md) explains passkeys and account recovery in more detail.

## Next steps

- Put content on a screen with [Your first screen](./first-screen.md).
- Learn how the parts fit together in [Architecture](../concepts/architecture.md).
- Prepare a production server with [Self-hosting](../administration/self-hosting.md).

## Troubleshooting

**The server container restarts in a loop.** Run `docker compose logs backend`. A message about a missing environment variable names the variable to add to `.env`. After changing `.env`, run `docker compose up -d` again.

**Sign-up says that the network requires an invitation.** Edit the network in the admin tool and clear **Invitation Only Mode**.

**Sign-up says "Network not found".** The network domain does not match the dashboard address. Edit the network in the admin tool and set the domain to exactly `localhost:3000`.

**Sign-up says "Failed to send email".** The server cannot reach a mail server. Check that `docker-compose.override.yaml` exists and that the `mailpit` container is running.

**Uploaded images do not load.** Check that `MEDIA_PUBLIC_BASE_URL` is set to `http://localhost:4000`. Without it, the server generates HTTPS media addresses that do not work locally.

**Uploaded files disappear after `docker compose down`.** The default configuration stores media inside the server container. That is fine for evaluation; production servers need [persistent media storage](../administration/self-hosting.md#media-storage).
