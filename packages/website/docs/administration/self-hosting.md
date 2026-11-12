---
sidebar_position: 1
title: Self-hosting
description: Run Castmill in production with Docker, a reverse proxy, persistent media storage and backups.
---

# Self-hosting

Castmill is open source and you can run it on your own infrastructure. This page describes a production installation. To try Castmill on your computer first, follow the [Quick start](../getting-started/quick-start.md).

## What you run

| Component | Image or package | Notes |
| --- | --- | --- |
| Castmill server | `Dockerfile` in the repository root | Phoenix application. Serves the API, WebSockets, the admin tool, the web player and local media. Runs database migrations on every start. |
| Dashboard | `Dockerfile-dashboard` | Static single-page application served by nginx on port 3000. |
| PostgreSQL | PostgreSQL 16 | The only stateful service. It also holds the background job queues, so there is no Redis or message broker. |
| Mail | Any SMTP server, or Mailgun | Needed for sign-up, invitations and account recovery. |
| Reverse proxy | nginx, Caddy, Traefik or a cloud load balancer | Terminates HTTPS and forwards WebSocket connections. |

The server image also needs to reach the internet for widgets that fetch external data, such as weather and RSS feeds.

## Domains

Use two host names, for example:

- `app.example.com` for the dashboard. This is also the domain of your [network](../concepts/networks.md).
- `api.example.com` for the Castmill server.

The server decides which network a request belongs to from the browser's `Origin` header, so the network domain must be exactly the dashboard host name. Cross-origin requests are only accepted from network domains. When you serve several networks from one installation, give each network its own dashboard domain.

HTTPS is required in production. The session cookie is sent with `SameSite=None; Secure`, which browsers only accept over HTTPS, and passkeys only work on secure origins.

## Build the images

The dashboard reads the server address at build time, so build it with your own values. One dashboard build can serve any number of network domains.

```bash
docker build -f Dockerfile-dashboard \
  --build-arg VITE_API_URL=https://api.example.com \
  --build-arg VITE_WS_ENDPOINT=wss://api.example.com \
  -t castmill-dashboard .

docker build -t castmill-server .
```

## Configure the server

The server is configured with environment variables. The [configuration reference](./configuration.md) lists all of them. A minimal production setup sets:

```bash
CASTMILL_HOST=api.example.com
MEDIA_PUBLIC_BASE_URL=https://api.example.com
DATABASE_URL=ecto://USER:PASSWORD@HOST/castmill
SECRET_KEY_BASE=...              # openssl rand -base64 48
ENCRYPTION_MASTER_KEY=...        # openssl rand -base64 32
CASTMILL_DASHBOARD_USER_SALT=... # openssl rand -hex 16
CASTMILL_ROOT_USER_EMAIL=admin@example.com
CASTMILL_ROOT_USER_PASSWORD=...
DASHBOARD_URL=https://app.example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
MAILER_FROM=signage@example.com
AWS_ACCESS_KEY_ID=unused
AWS_SECRET_ACCESS_KEY=unused
```

Every secret can also be read from a file: set `NAME_FILENAME` to the path instead of `NAME`. This works with Docker and Kubernetes secrets, and it is how the bundled `docker-compose.yaml` passes them.

:::warning Back up the encryption key
`ENCRYPTION_MASTER_KEY` encrypts integration credentials such as API keys and OAuth tokens. If you lose it, those credentials cannot be recovered and must be entered again. To rotate it, see [Encryption keys](./configuration.md#encryption-keys).
:::

## Reverse proxy

The proxy must forward WebSocket upgrades. Players keep a WebSocket open to `/socket`, the dashboard to `/user_socket`, and the admin tool uses `/live`. Allow large request bodies for media uploads and long timeouts for the WebSockets.

```nginx title="/etc/nginx/conf.d/castmill.conf"
server {
  listen 443 ssl;
  server_name api.example.com;
  # ssl_certificate and ssl_certificate_key ...

  client_max_body_size 2g;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 1h;
  }
}

server {
  listen 443 ssl;
  server_name app.example.com;
  # ssl_certificate and ssl_certificate_key ...

  location / {
    proxy_pass http://127.0.0.1:3000;
  }
}
```

Set `client_max_body_size` to at least the largest **max upload size** in your [plans](./plans-and-quotas.md).

## First start

1. Start the server. It runs the migrations, then listens on port 4000.
2. Check `https://api.example.com/api/health`. It returns `{"status":"ok"}`. `/api/version` returns the build and version.
3. Sign in to the admin tool at `https://api.example.com/admin` with the root user.
4. [Create a network](./admin-tool.md#networks) with the domain `app.example.com`.
5. Sign up in the dashboard, then make yourself a [network administrator](./admin-tool.md#network-administrators).

## Media storage

Uploaded media and generated thumbnails and transcodes are written to the server's local disk by default, in `/app/lib/castmill-<version>/priv/static/medias` inside the container, and served by the server under `/medias`. That directory is part of the container, so mount a persistent volume there:

```yaml
services:
  backend:
    volumes:
      - media:/app/lib/castmill-2.0.0/priv/static/medias
volumes:
  media:
```

Use the version from `packages/castmill/mix.exs`, and update the path when you upgrade to a new version.

`MEDIA_PUBLIC_BASE_URL` is the address at which browsers and players fetch these files. Set it to the public server address, or to a CDN that pulls from the server. Without it, the server uses `https://CASTMILL_HOST`.

When you run more than one server node, every node needs the same files. Use a shared file system, or S3-compatible object storage. S3 storage is selected at build time with `config :castmill, :file_storage, :s3` and the `:ex_aws` settings in `packages/castmill/config`; the files are stored in the bucket named by `AWS_S3_BUCKET`, using `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_REGION`.

## Scaling

One server node handles a large number of screens, because players spend most of their time on an idle WebSocket and play from their local cache. Media processing (image resizing and video transcoding with FFmpeg) is the most demanding work.

The server can run in three modes, set with `CASTMILL_NODE_MODE`:

| Mode | Runs |
| --- | --- |
| `web+worker` (default) | HTTP, WebSockets and background jobs |
| `web` | HTTP and WebSockets only |
| `worker` | Background jobs only, no HTTP port |

To scale, run several `web` nodes behind the load balancer and one or more `worker` nodes for transcoding. All nodes only need the same database, and the same media storage. They do not need to be clustered. Background jobs can use their own database with `BULLMQ_DATABASE_URL`.

Database connections: each node opens `POOL_SIZE` (default 10) connections for the application and `BULLMQ_DB_POOL_SIZE` (default 10) for jobs. Make sure PostgreSQL's `max_connections` covers all nodes.

## Backups

Back up:

- The PostgreSQL database, with `pg_dump` or your provider's snapshots. It contains all accounts, content definitions, schedules and job queues.
- The media storage volume or bucket.
- Your environment and secrets, in particular `ENCRYPTION_MASTER_KEY` and `SECRET_KEY_BASE`.

To restore, restore the database and media first, then start the server with the same secrets.

## Upgrades

1. Read the release notes.
2. Back up the database.
3. Build or pull the new images.
4. Restart the server. It applies new migrations before it accepts requests. Players reconnect automatically and keep playing from their cache while the server is down.

## Players

Every player needs the address of your server. The [Players](../players/overview.md) chapter explains how to point each player type to it.
