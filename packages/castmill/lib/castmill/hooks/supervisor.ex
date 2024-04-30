defmodule Castmill.Hooks.Supervisor do
  use Supervisor

  def start_link(_opts) do
    Supervisor.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @impl true
  def init(_state) do
    children = [
      Castmill.Hooks,
      Castmill.Addons.Supervisor
    ]

    # We use rest_for_one strategy to ensure that if the Castmill.Hooks process
    # crashes, the Castmill.Addons.Supervisor process will be restarted, but not
    # the other way around, as we need the Addons to re-register their hooks
    opts = [strategy: :rest_for_one, name: Castmill.Hooks.Supervisor]
    Supervisor.init(children, opts)
  end
end
