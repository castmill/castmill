# Castmill

This is the server component of the Castmill platform. It provides the following features:
* An API for managing networks, organizations, users, devices, playlists and content.
* An admin web interface for managing all the above.
- A player server that allows devices to register, connect and play content.

## Usage

The server is implemented in [Elixir](https://elixir-lang.org/) using the [Phoenix framework](https://www.phoenixframework.org/). To start your Castmill server:

  * Run `mix setup` to install and setup dependencies
  * Start Phoenix endpoint with `mix phx.server` or inside IEx with `iex -S mix phx.server`

Now you can visit [`localhost:4000`](http://localhost:4000) from your browser to access the Device server, or
[`localhost:4000`](http://localhost:4000/admin) to access the admin interface.

Media files retain their storage URL in the database. When the server returns media
information, it generates player-facing URLs using `MEDIA_PUBLIC_BASE_URL` if set,
or the current Phoenix endpoint (local storage) or S3 endpoint (S3 storage) otherwise.
Changing this setting or the endpoint host does not require re-uploading media; restart
the server with the new configuration and reconnect players to refresh their media
information. The selected URL must be reachable from the players' network. For S3,
the public base URL must serve objects from the bucket root (without the bucket name
in the path).

## Learn more

  * Official website: https://castmill.com/
  * Guides: coming soon.
  * Docs: coming soon.


## Deployment

This server can be deployed on any host that supports docker.


### Fly.io

Fly.io is a cloud provider with pretty good support for elixir applications.
In order to deploy Castmill you will first need to signup in fly.io. At the time of writing
even though you can use it for free for development purposes it will require a credit card
in order to get the necessary free allowances.


## License

This software is open source and is covered by the [AGPLv3 license](./LICENSE.md). If you require a different license for commercial
purposes, please get in touch with us.
