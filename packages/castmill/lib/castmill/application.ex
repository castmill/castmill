defmodule Castmill.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    # Get Redis configuration
    redis_config = Application.get_env(:castmill, :redis, host: "localhost", port: 6379)
    bullmq_config = Application.get_env(:castmill, :bullmq, [])
    testing_mode = Keyword.get(bullmq_config, :testing) == :inline

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
            # Start Redis connection
            {Redix,
             name: :castmill_redis,
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
        CastmillWeb.Widgets.WidgetsLoader.load_and_insert_json_data()
      end

      {:ok, pid}
    end
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

    Enum.map(queues, fn {queue_name, opts} ->
      concurrency = if is_integer(opts), do: opts, else: Keyword.get(opts, :concurrency, 1)

      # Create a processor function that routes to the correct worker based on job name
      processor_fn = fn job ->
        route_job_to_worker(queue_name, job)
      end

      {BullMQ.Worker,
       queue: Atom.to_string(queue_name),
       connection: connection,
       processor: processor_fn,
       concurrency: concurrency,
       name: Module.concat([Castmill.Workers.BullMQ, queue_name])}
    end)
  end

  # Route a job to the appropriate worker module based on queue and job name
  defp route_job_to_worker(queue_name, %BullMQ.Job{name: job_name} = job) do
    worker_module =
      case {queue_name, job_name} do
        # Image transcoder queue
        {:image_transcoder, _} -> Castmill.Workers.ImageTranscoder
        
        # Video transcoder queue
        {:video_transcoder, _} -> Castmill.Workers.VideoTranscoder
        
        # Integration polling queue (for Spotify and similar OAuth pollers)
        {:integration_polling, _} -> Castmill.Workers.SpotifyPoller
        
        # Integrations queue (for API key based integrations)
        {:integrations, _} -> Castmill.Workers.IntegrationPoller
        
        # Maintenance queue - route based on job name
        {:maintenance, "integration_data_cleanup"} -> Castmill.Workers.IntegrationDataCleanup
        {:maintenance, "encryption_rotation"} -> Castmill.Workers.EncryptionRotation
        
        _ -> 
          require Logger
          Logger.error("Unknown job type: queue=#{queue_name}, name=#{job_name}")
          raise "Unknown job type: queue=#{queue_name}, name=#{job_name}"
      end

    worker_module.process(job)
  end
end
