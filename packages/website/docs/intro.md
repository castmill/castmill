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

## Installation

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

## Start your Castmill server

### Run migrations

Go to packages/castmill and run the migration script:

```bash
$ mix ecto.migrate
```

### Run the server
After that you can run the development server:

```bash
mix phx.server
```

### Login into the Admin tool

Point your browser to localhost:4000/admin
A login window will appear, by default the admin user and pass are: info@castmill.com and 1234567890

Before you can use Castmill you need to create at least one network. Since we are testing we will create a "localhost" network. Go to Networks and click on "Create". A modal will appear that you can fill with test data, the important field that you need to change is Domain, you must use "localhost", as that will be the domain you use when you test from your local machine.


### Start the dasboard

Start the dashboard going to packages/dashboard and run "yarn && yarn dev". A dev server will be started at http://localhost:3000.

### Login into the dashboard

 You can point your browser that url and a login / signup modal will appear. Since this is the first time you access the dashboard you will specify an email address (does not need to be a real one) and click on "Signup".

Check sent email in the swoosh email webapp: ```http://localhost:4000/dev/mailbox/```. There you should
find an email with a link to create your account, copy the link to your browser and follow the instructions.


