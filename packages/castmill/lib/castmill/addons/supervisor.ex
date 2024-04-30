defmodule Castmill.Addons.Supervisor do
  use Supervisor

  def start_link(_opts) do
    Supervisor.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @impl true
  def init(_state) do
    children = [
      Castmill.Addons.Onboarding
    ]

    opts = [strategy: :one_for_one, name: Castmill.Addons.Supervisor]
    Supervisor.init(children, opts)
  end
end
