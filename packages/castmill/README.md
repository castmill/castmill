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

### Admin passkeys

The Phoenix admin tool requires a root user's passkey, separately from dashboard
passkeys. On first use, sign in with the existing root email/password and register
a passkey within five minutes. This grants no admin access until registration
succeeds. After enrollment, password login is disabled for that root user.

Use **Admin passkeys** in the sidebar to register a backup passkey on a separate
device. Both enrollment and sign-in require authenticator user verification
(biometric or device PIN). Discoverable ES256 and RS256 credentials are supported.
You cannot remove your last passkey. Adding or removing a key revokes other admin
sessions, including connected LiveViews; removing a key signs you out.

Deploy the database migration and rebuild the Phoenix assets with
`mix assets.deploy`. Existing password-authenticated admin sessions must sign in
again. The admin tool must be served from the configured Phoenix endpoint URL:
HTTPS in production, or `http://localhost:4000` for local development.
`CASTMILL_HOST` configures the production endpoint hostname. WebAuthn verifies the
exact endpoint origin and uses its hostname as the RP ID; proxy headers and
network/dashboard domains cannot override it. Changing that hostname requires
new passkeys. Do not serve the admin tool under a different hostname.

If all admin passkeys are lost, a trusted operator can reset **only admin**
credentials from a release console (for example `bin/castmill remote`):

```elixir
user = Castmill.Accounts.get_user_by_email("root@example.com")
Castmill.Accounts.AdminPasskeys.reset(user.id)
```

Verify the root account and operator authorization before running this command.
It removes that user's admin passkeys and revokes their admin sessions and pending
enrollment tokens, but leaves dashboard credentials intact. The user must then
enroll a new key using their root email/password. There is deliberately no
email/password fallback or HTTP recovery endpoint after enrollment.

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
