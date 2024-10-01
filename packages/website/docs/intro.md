---
sidebar_position: 1
---

# Introduction

![Castmill](./img/castmill.png)

Welcome to **Castmill**, a comprehensive open source platform for creating and managing digital signage, including content management, device management, APIs and SDKs for third party integrations and extensions.

Let's discover **Castmill in less than 5 minutes**.

# Getting Started

You can start with Castmill by running the main Castmill Server, which is an [Elixir/Phoenix](https://https://www.phoenixframework.org/) application that provides a robust service for managing from one to thousands of devices, as well as admin users, networks, content and more.

The Castmill Server is a standalone application that can be installed on any Linux server, and it is also available as a Docker image. If you want you can also clone this repo and run the server locally.

## Using Docker Compose

If you want to get a quick an easy installation, either for testing or for running in any Docker compatible infrastructure, you can use the provided docker compose file, that will easily get you a complete functional Castmill instance.

In order to use the docker compose file you are going to need to clone the castmill repository to the machine where you want to run the service:
```bash
git clone https://github.com/castmill/castmill.git
```

Then you can go to the castmill directory and run the following command:
```bash
docker-compose up
```

This will start the Castmill server, the dashboard and the database. This will take a few minutes the first time you run it, as it will download the images and build the server and the dashboard. When it finishes you will see the logs of the services running in the terminal, and you should be able to access the following services:

- Castmill Admin tool: http://localhost:4000/admin
- Castmill Player: http://localhost:4000
- Castmill Dashboard: http://localhost:3000

### Login into the Admin tool

The admin tool is where you can manage your networks, devices, users and content. 
You can now login into the admin tool using the default user and password: 
- email: root@example.com
- password: root

If you can login, then the service is running normally and you can start creating your networks, devices and content. Note that you
can configure the admin user and password in the docker-compose.yml file, but only the first time you run the container as this root
user is created in the database in a migration step.

### Sign up into the Dashboard

The dasboard is the main interface that the users will use to interact with Castmill, the content and the devices. By default any users
can just sign up and start using the dashboard (we will offer an "invitation only" mode in the future).

The signup process is based on passkeys ([read more about passkeys](https://fidoalliance.org/passkeys/)). Passkeys are a modern and secure way to authenticate users, and they are based on the device's biosignature. This means that the user will need to use the same device to sign up and login into the dashboard, however it will be possible to associate different devices to the same account.

As soon as you sign up you will receive an email with a link to verify and create your account, note that this will only work if you
have a valid email configuration in the docker-compose.yml file.

### Register a device

After you have created your account you can register a device. This is the first step to start using Castmill, as you will need to have at least one device to showing content. You can register a device by clicking on the "Devices" menu and then on "Register device". A modal will appear where you can fill the device information, including the device name and the device pincode.

You can open a browser player which is great for testing, just go to http://localhost:4000 and you will see a player registration page with some unique pincode. You can use this pincode to register a new device in the dashboard.

### Environment variables

There are several environment variables that you can set in the docker-compose.yml file to configure the Castmill server. The most important ones are:

### Database (DATABASE_URL)

This variable should point to a postgres database, you can use a local database or a remote one. If you are using the provided docker-compose file you can use the following value: ```ecto://postgres:postgres@db:5432/castmill_dev```
 
### Secret key base (SECRET_KEY_BASE)

This is a secret key that is used to sign the session cookies, you can generate a new one for example by running the following command: ```mix phx.gen.secret```

### Castmill host and port (CASTMILL_HOST, CASTMILL_PORT)

These variables are used to configure the host and port where the Castmill server will be running. If you are using the provided docker-compose file you can use the following values: ```CASTMILL_HOST: localhost``` and ```CASTMILL_PORT: 4000```

### Dashboard URI (CASTMILL_DASHBOARD_URI)

This variable is used to configure the URI where the Castmill dashboard will be running. If you are using the provided docker-compose file you can use the following value: ```CASTMILL_DASHBOARD_URI: http://localhost:3000```.
When running the provided docker-compose.yml file, the dashboard will be available at http://localhost:3000, so this variable should match
this value, but in production you should set it to the domain where the dashboard will be available.

### Dashboard user salt (CASTMILL_DASHBOARD_USER_SALT)

This variable is used to salt the user session cookies.

### Root user email and password (CASTMILL_ROOT_USER_EMAIL, CASTMILL_ROOT_USER_PASSWORD)

These variables are used to configure the root user that will be created in the database when the server starts. 

### Mailgun configuration (MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILER_FROM)

These variables are used to configure the mailgun service that is used to send emails from the server. You can create a free account at mailgun.com and get the API key and domain to use in these variables. Note that without these variables set the server will not be able to send emails, so you will not be able to create new users or reset passwords.

### AWS S3 configuration (AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)

These variables are used to configure the AWS S3 bucket where the media files will be stored. You can create a free account at aws.amazon.com and get the access key and secret to use in these variables. Note that without these variables set the server will not be able to store media files, so you will not be able to upload images or videos to the server.

# Local development

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


