defmodule Castmill.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  require Logger

  @impl true
  def start(_type, _args) do
    # Get Redis configuration
    redis_config = Application.get_env(:castmill, :redis, host: "localhost", port: 6379)
    bullmq_config = Application.get_env(:castmill, :bullmq, [])
    testing_mode = Keyword.get(bullmq_config, :testing) == :inline

    # Validate Redis connectivity before starting if not in testing mode
    unless testing_mode do
      validate_redis_connection!(redis_config)
    end

    # Build children list conditionally based on testing mode
    base_children = [
      # Start the Telemetry supervisor
      CastmillWeb.Telemetry,
      # Start the Ecto repository
      Castmill.Repo,

      # Start the PubSub system
      {Phoenix.PubSub, name: Castmill.PubSub},
      # Start Finch
      {Finch, name: Castmill.Finch},
      # Start the Endpoint (http/https)
      CastmillWeb.Endpoint,
      # Start a worker by calling: Castmill.Worker.start_link(arg)
      # {Castmill.Worker, arg}

      # Start the Hoos supervisor tree
      Castmill.Hooks.Supervisor
    ]

    # Add Redis and BullMQ workers only if not in testing mode
    children =
      if testing_mode do
        base_children
      else
        base_children ++
          [
            # Start BullMQ Redis connection pool (includes NimblePool + Registry)
            {BullMQ.RedisConnection,
             name: :castmill_redis,
             host: Keyword.get(redis_config, :host),
             port: Keyword.get(redis_config, :port),
             pool_size: 10},
            # Start a direct Redix connection for JobScheduler
            # (BullMQ.JobScheduler uses Redix.command directly instead of the pool)
            {Redix,
             name: :castmill_redis_direct,
             host: Keyword.get(redis_config, :host),
             port: Keyword.get(redis_config, :port)}
          ] ++
          build_bullmq_workers(bullmq_config)
      end

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Castmill.Supervisor]

    with {:ok, pid} <- Supervisor.start_link(children, opts) do
      # After starting the supervision tree, load the Widgets from JSON files
      # Ensure that the Repo is started before this call
      env = Application.get_env(:castmill, :env)

      if env != :test do
        load_widgets_with_retry()
      end

      {:ok, pid}
    end
  end

  # Load widgets with retry logic for database availability
  defp load_widgets_with_retry(attempts \\ 3, delay \\ 1000) do
    try do
      CastmillWeb.Widgets.WidgetsLoader.load_and_insert_json_data()
    rescue
      e in DBConnection.ConnectionError ->
        handle_widget_load_error(e, attempts, delay, :db_connection)

      e in ArgumentError ->
        # ETS table errors can occur if the Repo isn't fully initialized
        if String.contains?(Exception.message(e), "ETS table") do
          handle_widget_load_error(e, attempts, delay, :ets_table)
        else
          reraise e, __STACKTRACE__
        end
    end
  end

  defp handle_widget_load_error(error, attempts, delay, error_type) do
    if attempts > 1 do
      reason =
        case error_type do
          :db_connection -> "Database not ready"
          :ets_table -> "Repo ETS table not ready"
        end

      Logger.warning(
        "#{reason}, retrying widget load in #{delay}ms... (#{attempts - 1} attempts remaining)"
      )

      Process.sleep(delay)
      load_widgets_with_retry(attempts - 1, delay * 2)
    else
      raise_database_error(error)
    end
  end

  defp raise_database_error(original_error) do
    db_config = Application.get_env(:castmill, Castmill.Repo, [])
    hostname = Keyword.get(db_config, :hostname, "localhost")
    database = Keyword.get(db_config, :database, "castmill_dev")

    raise """

    ═══════════════════════════════════════════════════════════════════════════════
    DATABASE CONNECTION FAILED
    ═══════════════════════════════════════════════════════════════════════════════

    Could not connect to PostgreSQL database "#{database}" at #{hostname}

    Original error: #{Exception.message(original_error)}

    SOLUTIONS:

    1. Start PostgreSQL locally:
       $ brew services start postgresql

       Or with Docker:
       $ docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:alpine

    2. Create the database:
       $ mix ecto.create

    3. Run migrations:
       $ mix ecto.migrate

    4. Check your config/dev.exs database configuration

    ═══════════════════════════════════════════════════════════════════════════════
    """
  end

  # Validate Redis connection before starting the application
  defp validate_redis_connection!(redis_config) do
    host = Keyword.get(redis_config, :host, "localhost")
    port = Keyword.get(redis_config, :port, 6379)

    Logger.info("Checking Redis connectivity at #{host}:#{port}...")

    case Redix.start_link(host: host, port: port) do
      {:ok, conn} ->
        case Redix.command(conn, ["PING"]) do
          {:ok, "PONG"} ->
            Logger.info("Redis connection successful")
            GenServer.stop(conn)
            :ok

          {:error, reason} ->
            GenServer.stop(conn)
            raise_redis_error(host, port, reason)
        end

      {:error, reason} ->
        raise_redis_error(host, port, reason)
    end
  end

  defp raise_redis_error(host, port, reason) do
    raise """

    ═══════════════════════════════════════════════════════════════════════════════
    REDIS CONNECTION FAILED
    ═══════════════════════════════════════════════════════════════════════════════

    Could not connect to Redis at #{host}:#{port}

    Error: #{inspect(reason)}

    BullMQ requires a running Redis instance for background job processing.

    SOLUTIONS:

    1. Start Redis locally:
       $ redis-server

       Or with Docker:
       $ docker run -d -p 6379:6379 redis:alpine

    2. Use inline mode for development (no Redis required):
       Add to config/dev.exs:

       config :castmill, :bullmq, testing: :inline

    3. Configure a different Redis host:
       Set REDIS_HOST and REDIS_PORT environment variables

    ═══════════════════════════════════════════════════════════════════════════════
    """
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    CastmillWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  # Build BullMQ worker specs from configuration
  defp build_bullmq_workers(config) do
    queues = Keyword.get(config, :queues, [])
    connection = Keyword.get(config, :connection, :castmill_redis)

    # NOTE: BullMQ.Worker API based on v1.2 documentation
    # See: https://hexdocs.pm/bullmq/BullMQ.Worker.html
    Enum.map(queues, fn {queue_name, opts} ->
      concurrency = if is_integer(opts), do: opts, else: Keyword.get(opts, :concurrency, 1)

      # Create a processor function that routes to the correct worker based on job name
      processor_fn = fn job ->
        route_job_to_worker(queue_name, job)
      end

      worker_id = Module.concat([Castmill.Workers.BullMQ, queue_name])

      # Use Supervisor.child_spec/2 to give each worker a unique id
      Supervisor.child_spec(
        {BullMQ.Worker,
         queue: Atom.to_string(queue_name),
         connection: connection,
         processor: processor_fn,
         concurrency: concurrency,
         name: worker_id},
        id: worker_id
      )
    end)
  end

  # Route a job to the appropriate worker module based on queue and job name
  defp route_job_to_worker(queue_name, %BullMQ.Job{name: job_name} = job) do
    worker_module =
      case {queue_name, job_name} do
        # Image transcoder queue
        {:image_transcoder, _} ->
          Castmill.Workers.ImageTranscoder

        # Video transcoder queue
        {:video_transcoder, _} ->
          Castmill.Workers.VideoTranscoder

        # Integration polling queue (for Spotify and similar OAuth pollers)
        {:integration_polling, _} ->
          Castmill.Workers.SpotifyPoller

        # Integrations queue (for API key based integrations)
        {:integrations, _} ->
          Castmill.Workers.IntegrationPoller

        # Maintenance queue - route based on job name
        {:maintenance, "integration_data_cleanup"} ->
          Castmill.Workers.IntegrationDataCleanup

        {:maintenance, "encryption_rotation"} ->
          Castmill.Workers.EncryptionRotation

        _ ->
          require Logger
          Logger.error("Unknown job type: queue=#{queue_name}, name=#{job_name}")
          raise "Unknown job type: queue=#{queue_name}, name=#{job_name}"
      end

    worker_module.process(job)
  end
end
