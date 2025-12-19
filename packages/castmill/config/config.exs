# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :castmill, :env, Mix.env()

config :elixir, :time_zone_database, Tzdata.TimeZoneDatabase

config :castmill,
  ecto_repos: [Castmill.Repo]

# Configures the endpoint
config :castmill, CastmillWeb.Endpoint,
  url: [scheme: "http", host: "localhost", port: 4000],
  render_errors: [
    formats: [html: CastmillWeb.ErrorHTML, json: CastmillWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Castmill.PubSub,
  live_view: [signing_salt: "Km2MOAJ1"]

# Configures the mailer
#
# By default it uses the "Local" adapter which stores the emails
# locally. You can see the emails in your browser, at "/dev/mailbox".
#
# For production it's recommended to configure a different adapter
# at the `config/runtime.exs`.
config :castmill, Castmill.Mailer, adapter: Swoosh.Adapters.Local

# Configure esbuild (the version is required)
config :esbuild,
  version: "0.17.11",
  default: [
    args:
      ~w(js/app.js js/device.js js/sw.js --bundle --target=es2017 --outdir=../priv/static/assets --external:/fonts/* --external:/images/*),
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => Path.expand("../deps", __DIR__)}
  ]

# Configure tailwind (the version is required)
config :tailwind,
  version: "3.2.7",
  default: [
    args: ~w(
      --config=tailwind.config.js
      --input=css/app.css
      --output=../priv/static/assets/app.css
    ),
    cd: Path.expand("../assets", __DIR__)
  ]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Ensure we use the Accounts impl.
config :castmill, accounts: Castmill.Accounts

# Configure the AddOns
config :castmill, :addons, [
  Castmill.Addons.Onboarding,
  Castmill.Addons.Content,
  Castmill.Addons.Playlists,
  Castmill.Addons.Medias,
  Castmill.Addons.Widgets,
  Castmill.Addons.Devices
]

# Configure File Uploads
config :castmill, :upload_settings,
  local: "medias/",
  s3: [bucket: System.get_env("AWS_S3_BUCKET") || "castmill-medias"]

config :castmill, :file_storage, :local

config :ex_aws, :hackney_opts, recv_timeout: 30_000

config :ex_aws, :s3,
  scheme: "http://",
  host: "localhost",
  # MinIO default port
  port: 9000,
  access_key_id: System.get_env("AWS_ACCESS_KEY_ID"),
  secret_access_key: System.get_env("AWS_SECRET_ACCESS_KEY")

# Configure Oban
config :castmill, Oban,
  plugins: [{Oban.Plugins.Pruner, max_age: 300}],
  engine: Oban.Engines.Basic,
  queues: [image_transcoder: 10, video_transcoder: 10, integration_polling: 5],
  repo: Castmill.Repo

# Configure Spotify OAuth (widget integration)
# In production, set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REDIRECT_URI
config :castmill, :spotify_oauth,
  client_id: System.get_env("SPOTIFY_CLIENT_ID"),
  client_secret: System.get_env("SPOTIFY_CLIENT_SECRET"),
  redirect_uri:
    System.get_env("SPOTIFY_REDIRECT_URI") || "http://localhost:4000/auth/spotify/callback",
  scopes: ["user-read-currently-playing", "user-read-playback-state"]

# Configure gettext
config :castmill, CastmillWeb.Gettext, default_locale: "en"

# Configure Ecto
config :castmill, Castmill.Repo, migration_timestamps: [type: :utc_datetime]

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
