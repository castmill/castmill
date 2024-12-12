# Castmill Legacy Adapter

The **Castmill Legacy Adapter** is a bridge designed to support legacy Castmill Electron and Android players by providing compatibility with their API expectations, while leveraging the functionality of the modern Castmill player. This adapter allows you to seamlessly transition from the old Castmill implementation to the new player, maintaining compatibility for older embeds.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Usage](#usage)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The Castmill Legacy Adapter serves at the endpoint where the old Castmill application was hosted. It ensures that legacy players, which rely on the original APIs, continue to function without modification. Internally, it proxies or adapts these requests to the new Castmill player, enabling a seamless experience for both legacy and new clients.

### Key Purpose:

- Maintain compatibility with legacy Electron and Android Castmill players.
- Integrate the modern Castmill player without disrupting existing workflows.

---

## Features

- **Legacy API Support**: Implements the APIs required by legacy players.
- **Modern Player Integration**: Uses the new Castmill player internally.
- **Seamless Transition**: Allows legacy embeds to function as expected without updates.
- **Endpoint Compatibility**: Serves on the original Castmill hosting URL.
- **Configurable Base URL**: Easily configure the default base URL using environment variables.

---

## Usage

1. Deploy the adapter to the same endpoint where the old Castmill was hosted.
2. Verify that legacy players point to this endpoint for their API interactions.
3. Test the functionality of legacy players to ensure smooth operation with the new Castmill player.

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
