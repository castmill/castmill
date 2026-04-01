---
sidebar_position: 1
---

# Quick Start

Get a fully functional Castmill instance running locally in under 5 minutes using Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- At least 2 GB of free RAM
- Ports 4000 and 3000 available

## 1. Clone the Repository

```bash
git clone https://github.com/castmill/castmill.git
cd castmill
```

## 2. Start the Services

```bash
docker-compose up
```

This starts three services:

| Service       | URL                     | Purpose                    |
| ------------- | ----------------------- | -------------------------- |
| **Server**    | `http://localhost:4000` | Elixir/Phoenix API backend |
| **Dashboard** | `http://localhost:3000` | Management interface       |
| **Database**  | internal                | PostgreSQL database        |

The first run takes a few minutes to build images and set up the database. You'll see logs from all services in your terminal.

## 3. Log In to the Admin Tool

Once the services are running, open the admin tool at:

```
http://localhost:4000/admin
```

Use the default credentials:

- **Email**: `root@example.com`
- **Password**: `root`

:::caution
Change the default credentials immediately in a production environment. The admin tool has full control over all networks, organizations, and data.
:::

## 4. Create Your First Network

A **network** is the top-level container in Castmill. Each network is tied to a domain and acts as an isolated silo of data.

1. In the admin tool, go to **Networks**
2. Click **Create Network**
3. Enter a name and domain (e.g., `localhost` for local testing)
4. Save

## 5. Access the Dashboard

Open the dashboard at:

```
http://localhost:3000
```

Sign up with your email address. Castmill uses **passkey-based authentication** — no passwords. Your browser will prompt you to create a passkey during signup.

After signing up, you'll land in your organization's dashboard where you can:

- Upload media (images and videos)
- Create playlists with widgets
- Set up channels with schedules
- Register and manage display devices

## What's Next?

- [First Login](./first-login.md) — Detailed walkthrough of account creation and passkey setup
- [Concepts: Architecture](../concepts/architecture.md) — Understand how Networks, Organizations, and Resources fit together
- [Dashboard Overview](../dashboard/overview.md) — Learn the dashboard interface
- [Self-Hosting Guide](./self-hosting.md) — Production deployment options
