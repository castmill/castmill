import Config

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :castmill, Castmill.Repo,
  username: "postgres",
  password: "postgres",
  hostname: System.get_env("POSTGRES_HOST") || "localhost",
  database: "castmill_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: 20,
  queue_target: 5000,
  queue_interval: 5000

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :castmill, CastmillWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "vQj/9DOCuLIfbd/SI7T2uxb0rVjBrP/eYAB33oWAjbIuhoJKgthj/+vt4Tr2XJKz",
  server: false

# Encryption configuration for tests (deterministic key for reproducibility)
# DO NOT use this key in production!
config :castmill, :encryption, %{
  keys: %{
    1 => :crypto.hash(:sha256, "castmill-test-encryption-key-v1-not-for-production")
  },
  current_version: 1
}

# In test we don't send emails.
config :castmill, Castmill.Mailer, adapter: Swoosh.Adapters.Test

# Disable swoosh api client as it is only required for production adapters.
config :swoosh, :api_client, false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Ensure we use the mocks when testing
config :castmill, accounts: Castmill.AccountsMock

# Configure BullMQ for tests - inline mode
config :castmill, :bullmq, testing: :inline

# Run integration poll scheduling inline in tests to avoid detached tasks
# outliving SQL sandbox owners.
config :castmill, :async_poll_scheduling, false

# Run other background tasks inline in tests to avoid SQL sandbox disconnect noise.
config :castmill, :async_background_tasks, false
