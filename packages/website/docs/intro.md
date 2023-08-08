---
sidebar_position: 1
---

# Introduction

![Castmill](./img/castmill.png)

Welcome to **Castmill**, a comprehensive open source platform for creating and managing digital signage, including content management, device management, APIs and SDKs for third party integrations and extensions.

Let's discover **Castmill in less than 5 minutes**.

## Getting Started

You can start with Castmill by running the main Castmill Server, which is a [Elixir/Phoenix](https://https://www.phoenixframework.org/) application that provides a robust service for managing from one to thousands of devices, as well as admin users, networks, content and more.

The Castmill Server is a standalone application that can be installed on any Linux server, and it is also available as a Docker image. If you want you can also clone this repo and run the server locally.

### Installation

Coming soon.

### Docker

Coming soon.

### Local

#### What you'll need

- [Node.js](https://nodejs.org/en/download/) version 16.14 or above:
  - When installing Node.js, you are recommended to check all checkboxes related to dependencies.

- [Elixir](https://elixir-lang.org/install.html) version 1.12 or above:
  - When installing Elixir, you are recommended to check all checkboxes related to dependencies.

- [PostgreSQL](https://www.postgresql.org/download/) version 13 or above:


#### Start your Castmill server

Run the development server:

```bash
cd my-castmill-server
mix phx.server
```
