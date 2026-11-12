---
sidebar_position: 2
title: Configuration reference
description: Every environment variable and build argument of the Castmill server and dashboard.
---

# Configuration reference

The Castmill server reads its configuration from environment variables when it starts. The dashboard is a static application, so its settings are build arguments.

## Secrets from files

Each variable marked **file** in the tables below can also be read from a file. Set `NAME_FILENAME` to the path of a file that contains the value, for example `DATABASE_URL_FILENAME=/run/secrets/database_url`. If both are set, `NAME` wins. Use files for secrets in production, so they do not show up in process listings and crash reports.

## Server

### Required

| Variable | Description |
| --- | --- |
| `DATABASE_URL` (file) | PostgreSQL connection, for example `ecto://USER:PASSWORD@HOST/DATABASE`. |
| `SECRET_KEY_BASE` (file) | Signs and encrypts cookies and tokens. At least 64 characters: `openssl rand -base64 48`. |
| `ENCRYPTION_MASTER_KEY` (file) | Encrypts integration credentials. A base64-encoded 32-byte key: `openssl rand -base64 32`. See [Encryption keys](#encryption-keys). |
| `CASTMILL_DASHBOARD_USER_SALT` (file) | Salt for dashboard session tokens. |
| `CASTMILL_ROOT_USER_EMAIL` (file) | Email of the admin tool account. |
| `CASTMILL_ROOT_USER_PASSWORD` (file) | Password of the admin tool account. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (file) | Object storage credentials. The server does not start without a value, even with local storage; use any placeholder then. |

`SECRET_KEY_BASE`, `CASTMILL_DASHBOARD_USER_SALT` and the root user have built-in defaults so that development works out of the box. Those defaults are public. Always set your own values in production.

### Addresses

| Variable | Default | Description |
| --- | --- | --- |
| `CASTMILL_HOST` | `localhost` | Public host name of the server. Generated URLs use `https://CASTMILL_HOST`. |
| `PORT` | `4000` | Port the server listens on. |
| `MEDIA_PUBLIC_BASE_URL` | `https://CASTMILL_HOST` | Base address of media files for browsers and players, such as `https://media.example.com`. Must be an absolute HTTP or HTTPS URL. |
| `DASHBOARD_URL` | `http://localhost:3000` | Dashboard address used in email verification and recovery links. |

### Email

If `SMTP_HOST` is set, the server sends mail over SMTP. Otherwise it uses Mailgun. Do not set `SMTP_HOST` to an empty string: an empty value still selects SMTP.

| Variable | Default | Description |
| --- | --- | --- |
| `SMTP_HOST` | | SMTP server host name. |
| `SMTP_PORT` | `587` | SMTP port. |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | | SMTP credentials, if the server needs them. |
| `SMTP_SSL` | `false` | `true` for implicit TLS, usually on port 465. STARTTLS is used when the server offers it. |
| `MAILGUN_API_KEY` (file) | | Mailgun API key. Required when `SMTP_HOST` is not set. |
| `MAILGUN_DOMAIN` | | Mailgun sending domain. |
| `MAILGUN_BASE_URL` | | Mailgun API address, for example `https://api.eu.mailgun.net/v3` for the EU region. |
| `MAILER_FROM` | | Sender address of all mail. |

### Database and background jobs

| Variable | Default | Description |
| --- | --- | --- |
| `POOL_SIZE` | `10` | Database connections per node for the application. |
| `ECTO_IPV6` | | `true` to connect to the database over IPv6. |
| `BULLMQ_DATABASE_URL` (file) | `DATABASE_URL` | Separate PostgreSQL database for the job queues. |
| `BULLMQ_DB_SCHEMA` | `bullmq` | Schema of the job queue tables. |
| `BULLMQ_DB_POOL_SIZE` | `10` | Database connections per node for jobs. |
| `BULLMQ_DB_SSL` | `false` | `true` to use TLS for the job database, for example on AWS RDS with `rds.force_ssl`. |
| `BULLMQ_DB_SSL_VERIFY` | `verify_none` | `verify_peer` to verify the database certificate. |
| `CASTMILL_NODE_MODE` | `web+worker` | `web`, `worker` or `web+worker`. See [Scaling](./self-hosting.md#scaling). |

### Storage

| Variable | Description |
| --- | --- |
| `AWS_S3_BUCKET` | Bucket for media when S3 storage is enabled. See [Media storage](./self-hosting.md#media-storage). |
| `AWS_REGION` | Region of the bucket. Default `eu-central-1`. |

### Integrations

| Variable | Description |
| --- | --- |
| `OAUTH_REDIRECT_HOST` | Host used in OAuth callback addresses for widget integrations, when it differs from the request host. |
| `OAUTH_LOCALHOST_REPLACEMENT` | Replacement for `localhost` in OAuth callback addresses. Default `127.0.0.1`, which some providers, such as Spotify, require. |

API keys and OAuth client credentials of widget integrations are not environment variables. Enter them in the dashboard or the admin tool; see [Widgets](../dashboard/widgets.md).

### Build information

`CASTMILL_GIT_SHA` and `CASTMILL_BUILD_TIME` are reported by `/api/version`. Set them in your build pipeline.

## Encryption keys

`ENCRYPTION_MASTER_KEY` is key version 1. Each encrypted value records the version of the key that encrypted it, so you can rotate keys without downtime:

1. Generate a new key and set it as `ENCRYPTION_MASTER_KEY_V2`. Keep `ENCRYPTION_MASTER_KEY`.
2. Restart the server. New and updated credentials are encrypted with the highest version. Set `ENCRYPTION_CURRENT_VERSION` to choose another version.
3. Keep the old key as long as values encrypted with it exist. Values are decrypted with the key version they were encrypted with.

Up to ten versions are supported, `ENCRYPTION_MASTER_KEY` and `ENCRYPTION_MASTER_KEY_V2` to `ENCRYPTION_MASTER_KEY_V10`. A value that is not a base64-encoded 32-byte key is hashed to 32 bytes.

## Dashboard build arguments

| Argument | Example | Description |
| --- | --- | --- |
| `VITE_API_URL` | `https://api.example.com` | Server address. |
| `VITE_WS_ENDPOINT` | `wss://api.example.com` | Server WebSocket address, without a path. |

The dashboard takes its own origin and domain from the address it is opened on, so one build serves every network domain. `VITE_ORIGIN` and `VITE_DOMAIN` are only fallbacks outside a browser and do not need to be set.

Passkeys are bound to the domain on which they were created. If you change a network's dashboard domain, its users must register new passkeys, or recover their account by email.
