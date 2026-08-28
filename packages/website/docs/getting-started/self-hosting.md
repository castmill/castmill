---
sidebar_position: 3
---

# Self-Hosting Guide

Castmill can be self-hosted on any infrastructure that supports Docker or Elixir/Phoenix applications. This guide covers a production-ready setup.

## Architecture Overview

A Castmill deployment consists of:

```mermaid
graph TD
    Browser[Browser / Dashboard] -->|HTTPS| Server[Castmill Server<br/>Elixir/Phoenix]
    Device[Display Device] -->|HTTPS + WebSocket| Server
    Server --> DB[(PostgreSQL)]
    Server --> S3[Object Storage<br/>S3 / R2 / MinIO]
    Server --> SMTP[Email Service<br/>SMTP / Mailgun]
```

| Component           | Purpose                                     | Required? |
| ------------------- | ------------------------------------------- | --------- |
| **Castmill Server** | API, authentication, WebSocket connections  | Yes       |
| **PostgreSQL**      | Data storage (users, orgs, playlists, etc.) | Yes       |
| **Object Storage**  | Media file storage (images, videos)         | Yes       |
| **Email Service**   | Signup verification, invitations, recovery  | Yes       |
| **Redis**           | Background job processing (BullMQ workers)  | Yes       |

## Docker Deployment

### Production Docker Compose

Create a `docker-compose.yml` for production:

```yaml
version: '3.8'

services:
  castmill:
    image: ghcr.io/castmill/castmill:latest
    ports:
      - '4000:4000'
    environment:
      - DATABASE_URL=ecto://castmill:password@db/castmill
      - SECRET_KEY_BASE=your-64-char-secret-key
      - CASTMILL_HOST=your-domain.com
      - CASTMILL_PORT=4000
      - CASTMILL_SCHEME=https
      - PORT=4000
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - ENCRYPTION_MASTER_KEY=your-base64-32-byte-key
      # See Environment Variables section below
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: castmill
      POSTGRES_PASSWORD: password
      POSTGRES_DB: castmill
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U castmill']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes

volumes:
  pgdata:
```

### Generate a Secret Key

```bash
mix phx.gen.secret
```

Or use OpenSSL:

```bash
openssl rand -base64 48
```

## Object Storage Setup

Castmill stores uploaded media in S3-compatible object storage. You can use:

- **AWS S3** — Standard cloud storage
- **Cloudflare R2** — Zero egress fees (recommended for signage)
- **MinIO** — Self-hosted, S3-compatible

### MinIO (Local Development)

```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  -v ~/minio/data:/data \
  quay.io/minio/minio server /data --console-address ":9001"
```

Create a bucket named `castmill-media` through the MinIO console at `http://localhost:9001`.

### Configuration

Set these environment variables for your storage backend:

```bash
# AWS S3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=castmill-media
AWS_REGION=eu-north-1
```

For MinIO/R2 custom endpoints, update ExAws S3 settings (`scheme`, `host`, `port`):

- Use `config/runtime.exs` for Docker/release deployments (production runtime values)
- Use `config/config.exs` (or env-specific config) for local/source-based setups

Example:

```elixir
config :ex_aws, :s3,
  scheme: "http://",
  host: "localhost",
  port: 9000

# Example production R2 endpoint:
# scheme: "https://"
# host: "account-id.r2.cloudflarestorage.com"
# port: 443
```

## Email Configuration

Castmill requires email for signup verification, invitations, and credential recovery. Configure one of:

### Mailgun

```bash
MAILGUN_API_KEY=your-api-key
MAILGUN_DOMAIN=mail.your-domain.com
MAILER_FROM=noreply@your-domain.com
```

### SMTP (Generic)

```bash
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USERNAME=your-username
SMTP_PASSWORD=your-password
SMTP_SSL=false
MAILER_FROM=noreply@your-domain.com
```

## Environment Variables Reference

| Variable                | Required | Default                 | Description                       |
| ----------------------- | -------- | ----------------------- | --------------------------------- |
| `DATABASE_URL`          | Yes      | —                       | PostgreSQL connection string      |
| `SECRET_KEY_BASE`       | Yes      | —                       | Phoenix secret (min 64 chars)     |
| `CASTMILL_HOST`         | Yes      | `localhost`             | Public hostname                   |
| `CASTMILL_SCHEME`       | No       | `http`                  | Public URL scheme                 |
| `CASTMILL_PORT`         | No       | `4000`                  | Public URL port                   |
| `PORT`                  | No       | `4000`                  | Bound HTTP listen port            |
| `POOL_SIZE`             | No       | `10`                    | Database connection pool size     |
| `ENCRYPTION_MASTER_KEY` | Yes      | —                       | Encryption key for sensitive data |
| `AWS_ACCESS_KEY_ID`     | Yes      | —                       | S3 access key                     |
| `AWS_SECRET_ACCESS_KEY` | Yes      | —                       | S3 secret key                     |
| `AWS_S3_BUCKET`         | Yes      | —                       | S3 bucket name                    |
| `AWS_REGION`            | No       | `eu-central-1`          | S3 region                         |
| `MAILGUN_API_KEY`       | Cond.    | —                       | Mailgun API key (if using Mailgun) |
| `MAILGUN_DOMAIN`        | Cond.    | —                       | Mailgun sending domain            |
| `SMTP_HOST`             | Cond.    | —                       | SMTP relay hostname (if using SMTP) |
| `SMTP_PORT`             | No       | `587`                   | SMTP port                         |
| `SMTP_USERNAME`         | Cond.    | —                       | SMTP authentication username      |
| `SMTP_PASSWORD`         | Cond.    | —                       | SMTP authentication password      |
| `SMTP_SSL`              | No       | `false`                 | Set `true` for SSL/TLS (port 465) |
| `MAILER_FROM`           | No       | `no-reply@castmill.com` | Sender email address              |
| `REDIS_HOST`            | No       | `localhost`             | Redis host                        |
| `REDIS_PORT`            | No       | `6379`                  | Redis port                        |

## Database Setup

On first run, Castmill automatically runs migrations. To run them manually:

```bash
# Inside the Docker container (release image)
/app/bin/migrate

# Or when running from source
mix ecto.migrate
```

### Seeding

To create the initial admin user and set up default data:

```bash
mix run priv/repo/seeds.exs
```

## Reverse Proxy

For production, place Castmill behind a reverse proxy (Nginx, Caddy, or Cloudflare) for TLS termination:

### Nginx Example

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (required for device connections)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

:::important
WebSocket support is required. Devices maintain persistent WebSocket connections to the server for real-time updates.
:::

## Health Check

The server exposes a health endpoint:

```bash
curl http://localhost:4000/api/health
```

Returns `200 OK` when the server is ready.
