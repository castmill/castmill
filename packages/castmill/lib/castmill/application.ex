defmodule Castmill.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
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
      Castmill.Hooks.Supervisor,

      # Start the Oban supervisor tree
      {Oban, Application.fetch_env!(:castmill, Oban)},

      # Start the Relay Session Manager
      Castmill.Relay.SessionManager
    ]

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
end
