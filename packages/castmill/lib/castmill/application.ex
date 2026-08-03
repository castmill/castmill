defmodule Castmill.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  require Logger

  @impl true
  def start(_type, _args) do
    bullmq_config = Application.get_env(:castmill, :bullmq, [])
    testing_mode = Keyword.get(bullmq_config, :testing) == :inline
    mode = node_mode()

    Logger.info("Starting Castmill in node mode: #{node_mode_label(mode)}")

    # The child list is assembled from three parts based on the node mode:
    #   * base children (Repo, PubSub, and — for web nodes — the HTTP endpoint)
    #   * BullMQ connection + workers (worker nodes)
    #   * BullMQ QueueEvents completion listeners (web-only nodes)
    children =
      base_children(mode) ++
        bullmq_children(mode, bullmq_config, testing_mode) ++
        queue_events_children(mode, bullmq_config, testing_mode)

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Castmill.Supervisor]

    with {:ok, pid} <- Supervisor.start_link(children, opts) do
      # After starting the supervision tree, load the Widgets from JSON files
      # Ensure that the Repo is started before this call. Widget JSON loading is
      # a web-only concern, so worker-only nodes skip it.
      env = Application.get_env(:castmill, :env)

      if env != :test and web_node?(mode) do
        load_widgets_with_retry()
      end

      # Run job recovery after startup (non-blocking).
      # Uses deterministic job IDs so BullMQ dedup prevents duplicates.
      # Only nodes that actually run workers need to recover jobs.
      if not testing_mode and worker_node?(mode) do
        Task.start(fn ->
          # Give BullMQ workers a moment to fully initialize
          Process.sleep(5_000)
          Castmill.Workers.JobRecovery.recover_all()
        end)
      end

      {:ok, pid}
    end
  end

  # ---------------------------------------------------------------------------
  # Node modes
  #
  # A Castmill node can run in one of three modes, selected via the
  # `CASTMILL_NODE_MODE` environment variable (or `config :castmill, :node_mode`):
  #
  #   * `web+worker` (default) — the all-in-one node: Phoenix endpoint AND
  #     BullMQ workers on the same node. This is what unset/legacy deployments
  #     get, preserving full backwards compatibility.
  #   * `web`    — Phoenix endpoint only, no heavy job queues. Real-time
  #     completion updates arrive via the BullMQ QueueEvents listener.
  #   * `worker` — BullMQ workers only, no HTTP endpoint.
  #
  # `web` and `worker` tiers only need to share a PostgreSQL database; no BEAM
  # clustering between them is required.
  # ---------------------------------------------------------------------------

  @doc false
  def node_mode do
    case Application.get_env(:castmill, :node_mode) || System.get_env("CASTMILL_NODE_MODE") do
      nil -> :web_worker
      mode -> parse_node_mode(mode)
    end
  end

  defp parse_node_mode(mode) when is_atom(mode), do: parse_node_mode(Atom.to_string(mode))

  defp parse_node_mode(mode) when is_binary(mode) do
    case mode |> String.trim() |> String.downcase() do
      "web" -> :web
      "worker" -> :worker
      "web+worker" -> :web_worker
      "web_worker" -> :web_worker
      "" -> :web_worker
      other ->
        Logger.warning(
          "Unknown CASTMILL_NODE_MODE=#{inspect(other)}; defaulting to \"web+worker\""
        )

        :web_worker
    end
  end

  defp node_mode_label(:web), do: "web"
  defp node_mode_label(:worker), do: "worker"
  defp node_mode_label(:web_worker), do: "web+worker"

  # A node serves HTTP/WebSocket traffic in web and web+worker modes.
  defp web_node?(:web), do: true
  defp web_node?(:web_worker), do: true
  defp web_node?(:worker), do: false

  # A node processes background jobs in worker and web+worker modes.
  defp worker_node?(:worker), do: true
  defp worker_node?(:web_worker), do: true
  defp worker_node?(:web), do: false

  # Base children common to every node, plus the web-only endpoint stack for
  # web/web+worker nodes. The web+worker ordering is intentionally identical to
  # the historical (pre-node-mode) child list for full backwards compatibility.
  defp base_children(mode) do
    common = [
      # Start the Telemetry supervisor
      CastmillWeb.Telemetry,
      # Start the Ecto repository
      Castmill.Repo,
      # Start the PubSub system
      {Phoenix.PubSub, name: Castmill.PubSub},
      # Start Finch
      {Finch, name: Castmill.Finch}
    ]

    web_only = [
      # Start the single-use WebAuthn challenge store
      CastmillWeb.ChallengeStore,
      # Start the Endpoint (http/https)
      CastmillWeb.Endpoint
    ]

    tail = [
      # Start the Hooks supervisor tree
      Castmill.Hooks.Supervisor
    ]

    common ++ if(web_node?(mode), do: web_only, else: []) ++ tail
  end

  # BullMQ connection + workers. In inline testing mode nothing is started.
  # The Postgres connection is started on every non-testing node because web
  # nodes still need it to enqueue jobs (and to drive the QueueEvents listener),
  # while worker nodes need it to consume queues.
  defp bullmq_children(_mode, _bullmq_config, true = _testing_mode) do
    Logger.info("BullMQ running in inline testing mode; no BullMQ workers will be started")
    []
  end

  defp bullmq_children(mode, bullmq_config, false = _testing_mode) do
    connection = [bullmq_postgres_child_spec(bullmq_config)]

    workers =
      if worker_node?(mode) do
        queue_specs = Keyword.get(bullmq_config, :queues, [])

        Logger.info(
          "Starting BullMQ workers for queues: #{inspect(Enum.map(queue_specs, fn {q, _} -> q end))}"
        )

        build_bullmq_workers(bullmq_config)
      else
        []
      end

    connection ++ workers
  end

  # QueueEvents completion listeners. These are only started on web-only nodes:
  # in web+worker mode the worker is co-located with the web tier and already
  # broadcasts completion directly, so enabling the listener there would cause a
  # duplicate broadcast. This guarantees exactly one delivery path per topology.
  #
  # The mechanism is pluggable: each entry in `completion_event_queues` maps a
  # queue to the `BullMQ.QueueEvents.Handler` that re-broadcasts its completion
  # events on the local node. This is not transcoder-specific — any worker that
  # runs on a separate fleet and needs to notify the web tier (e.g. widget
  # upload processing) can register its own handler here. Entries may be given
  # as a bare queue atom (defaulting to `TranscoderEventsHandler`) or as a
  # `{queue, handler_module}` tuple.
  defp queue_events_children(:web, bullmq_config, false = _testing_mode) do
    connection = Keyword.get(bullmq_config, :connection, :castmill_bullmq)

    queues =
      Keyword.get(bullmq_config, :completion_event_queues, [:video_transcoder, :image_transcoder])

    Logger.info(
      "Starting BullMQ QueueEvents completion listeners for: #{inspect(normalize_event_queues(queues))}"
    )

    queues
    |> normalize_event_queues()
    |> Enum.map(fn {queue, handler} ->
      queue_name = to_string(queue)

      Supervisor.child_spec(
        {BullMQ.QueueEvents,
         queue: queue_name,
         connection: connection,
         handler: handler},
        id: Module.concat([Castmill.Workers.BullMQEvents, queue])
      )
    end)
  end

  defp queue_events_children(_mode, _bullmq_config, _testing_mode), do: []

  # Normalize `completion_event_queues` entries into `{queue, handler}` tuples.
  # A bare atom uses the default transcoder handler for backwards compatibility.
  @doc false
  def normalize_event_queues(queues) do
    Enum.map(queues, fn
      {queue, handler} when is_atom(handler) -> {queue, handler}
      queue when is_atom(queue) -> {queue, Castmill.Workers.TranscoderEventsHandler}
    end)
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

  defp bullmq_postgres_child_spec(bullmq_config) do
    connection_name = Keyword.get(bullmq_config, :connection, :castmill_bullmq)
    bullmq_pg_config = Application.get_env(:castmill, :bullmq_postgres, [])

    base_opts = [
      name: connection_name,
      schema: Keyword.get(bullmq_pg_config, :schema, "bullmq"),
      pool_size: Keyword.get(bullmq_pg_config, :pool_size, 10)
    ]

    conn_opts =
      case Keyword.get(bullmq_pg_config, :url) do
        nil ->
          compact_keyword(
            hostname: Keyword.get(bullmq_pg_config, :hostname),
            port: Keyword.get(bullmq_pg_config, :port),
            database: Keyword.get(bullmq_pg_config, :database),
            username: Keyword.get(bullmq_pg_config, :username),
            password: Keyword.get(bullmq_pg_config, :password)
          )

        url ->
          [url: url]
      end

    {BullMQ.Backends.Postgres.Connection, base_opts ++ conn_opts}
  end

  defp compact_keyword(keyword) do
    Enum.reject(keyword, fn {_key, value} -> is_nil(value) end)
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
    connection = Keyword.get(config, :connection, :castmill_bullmq)

    # NOTE: BullMQ.Worker API based on v2 documentation
    # See: https://hexdocs.pm/bullmq/BullMQ.Worker.html
    Enum.map(queues, fn {queue_name, opts} ->
      concurrency = if is_integer(opts), do: opts, else: Keyword.get(opts, :concurrency, 1)

      Logger.info(
        "Configuring BullMQ worker queue=#{queue_name} concurrency=#{concurrency} connection=#{inspect(connection)}"
      )

      # Create a processor function that routes to the correct worker based on job name
      processor_fn = fn job ->
        route_job_to_worker(queue_name, job)
      end

      worker_id = Module.concat([Castmill.Workers.BullMQ, queue_name])

      # Use Supervisor.child_spec/2 to give each worker a unique id.
      # Do not pass `name:` to BullMQ.Worker: BullMQ 2.0.2 forwards it to
      # Postgres as text and atom values cause DBConnection.EncodeError.
      Supervisor.child_spec(
        {BullMQ.Worker,
         queue: Atom.to_string(queue_name),
         connection: connection,
         processor: processor_fn,
         concurrency: concurrency,
         on_error: fn error ->
           Logger.error("BullMQ worker error queue=#{queue_name}: #{inspect(error)}")
         end,
         on_failed: fn job, reason ->
           Logger.error(
             "BullMQ job failed queue=#{queue_name} job=#{job.name} id=#{job.id}: #{inspect(reason)}"
           )
         end},
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

        # Email queue
        {:email, _} ->
          Castmill.Workers.EmailWorker

        _ ->
          require Logger
          Logger.error("Unknown job type: queue=#{queue_name}, name=#{job_name}")
          raise "Unknown job type: queue=#{queue_name}, name=#{job_name}"
      end

    worker_module.process(job)
  end
end
