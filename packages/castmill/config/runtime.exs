import Config

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/castmill start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :castmill, CastmillWeb.Endpoint, server: true
end

if config_env() == :prod do
  database_url =
    CastmillWeb.Secrets.get_database_url() ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  # Configures the mailer. For now we use Mailgun, maybe we can include others in the future
  config :castmill, Castmill.Mailer,
    adapter: Swoosh.Adapters.Mailgun,
    api_key: CastmillWeb.Secrets.get_mailgun_api_key(),
    domain: System.get_env("MAILGUN_DOMAIN")

  # Choose S3 or Local as file upload destination
  # config :castmill, :file_storage, :s3
  config :ex_aws,
    access_key_id: CastmillWeb.Secrets.get_aws_access_key_id(),
    secret_access_key: CastmillWeb.Secrets.get_aws_secret_access_key(),
    region: System.get_env("AWS_REGION") || "eu-central-1"

  maybe_ipv6 = if System.get_env("ECTO_IPV6") in ~w(true 1), do: [:inet6], else: []

  config :castmill, Castmill.Repo,
    # ssl: true,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    socket_options: maybe_ipv6

  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    CastmillWeb.Secrets.get_secret_key_base() ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host =
    if System.get_env("CASTMILL_HOST") in [nil, "", false],
      do: "localhost",
      else: System.get_env("CASTMILL_HOST")

  port = String.to_integer(System.get_env("CASTMILL_PORT") || "4000")

  config :castmill, CastmillWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Enable IPv6 and bind on all interfaces.
      # Set it to  {0, 0, 0, 0, 0, 0, 0, 1} for local network only access.
      # See the documentation on https://hexdocs.pm/plug_cowboy/Plug.Cowboy.html
      # for details about using IPv6 vs IPv4 and loopback vs public addresses.
      ip: {0, 0, 0, 0, 0, 0, 0, 0},
      port: port
    ],
    secret_key_base: secret_key_base
end
