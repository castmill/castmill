# Castmill Legacy Adapter

The **Castmill Legacy Adapter** is a bridge designed to support legacy Castmill Electron and Android players by providing compatibility with their API expectations, while leveraging the functionality of the modern Castmill player. This adapter allows you to seamlessly transition from the old Castmill implementation to the new player, maintaining compatibility for older embeds.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Usage](#usage)
- [Serving from Castmill](#serving-from-castmill)
- [Migration rollout](#migration-rollout)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The Castmill Legacy Adapter enables old Castmill Electron and Android players to connect to a new Castmill server without changing those players. It preserves the legacy player APIs and adapts them to the modern Castmill player and server.

### Key Purpose:

- Allow existing legacy Castmill players to connect to new Castmill deployments.
- Maintain compatibility with the Electron and Android legacy player APIs.
- Enable migration to the modern player without disrupting existing workflows.

---

## Features

- **Legacy API Support**: Implements the APIs required by legacy players.
- **Modern Player Integration**: Uses the new Castmill player internally.
- **Seamless Transition**: Allows legacy embeds to function as expected without updates.
- **Castmill Server Deployment**: Served at `/legacy` by the Castmill Phoenix server.
- **Configurable Base URL**: Easily configure the default base URL using environment variables.

---

## Usage

1. Build the Castmill server image or run `yarn build:server` from the repository root.
2. Open the adapter at `https://<castmill-server>/legacy`.
3. Test the functionality of legacy players to ensure smooth operation with the new Castmill player.

---

## Serving from Castmill

The production Castmill build runs this workspace's `build:server` script. It generates
the adapter in `packages/castmill/priv/static/legacy/`, which Phoenix serves as:

| URL                | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `/legacy`          | Legacy adapter entry page                     |
| `/legacy/assets/*` | Adapter JavaScript and other generated assets |

Use `yarn build` for a standalone workspace build, or `yarn build:server` to generate
the files for the Castmill server. The server-targeted build uses `/legacy/` as its Vite
base URL, so generated assets load from the same Castmill server.

---

## Migration rollout

During migration, the old Castmill player server proxies migrated players to `/legacy`
on the new Castmill Phoenix server. This allows individual legacy players to use the new
server while the old player domain continues to serve players that have not migrated.

After all players have migrated, point the old player domain at the new Phoenix server.
The Phoenix server must then serve the same legacy adapter content for requests received
through that domain as it does for `/legacy`.

---

## Configuration

### Base URL Configuration

The adapter allows you to configure a default base URL by setting the `VITE_BASE_URL` environment variable in a `.env.local` file. This ensures flexibility when running the adapter in different environments.

1. Create a `.env.local` file in the project root if it doesn’t already exist.
2. Add the following line to specify the base URL:

   ```env
   VITE_BASE_URL="http://192.168.1.1:4000"
   ```

   Replace `http://192.168.1.1:4000` with the appropriate base URL for your setup.

3. Build and restart the server for the changes to take effect:
   ```bash
   yarn build && yarn serve
   ```

This base URL will be used to adapt API calls and ensure the correct routing to the modern Castmill player.

---

## Contributing

We welcome contributions to enhance the functionality and robustness of the Castmill Legacy Adapter. Please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Submit a pull request with a detailed explanation of your changes.

---

For questions, issues, or feature requests, please open an issue in the GitHub repository.
