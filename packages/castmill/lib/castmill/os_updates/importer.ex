defmodule Castmill.OsUpdates.Importer do
  @moduledoc """
  Imports new Castmill OS releases from GitHub shortly after startup and then
  every `import_interval` (default one hour). Imports are idempotent, so it is
  harmless when several nodes run it.

      config :castmill, Castmill.OsUpdates,
        github_repo: "castmill/castmill-os",
        import_interval: :timer.hours(1)   # nil disables the importer
  """
  use GenServer
  require Logger

  @first_import_delay :timer.seconds(30)

  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @doc "The importer child spec, or nothing when imports are disabled."
  def children do
    case interval() do
      ms when is_integer(ms) and ms > 0 -> [__MODULE__]
      _ -> []
    end
  end

  @impl true
  def init(_opts) do
    Process.send_after(self(), :import, @first_import_delay)
    {:ok, %{}}
  end

  @impl true
  def handle_info(:import, state) do
    case Castmill.OsUpdates.import_from_github() do
      {:ok, _new} -> :ok
      {:error, reason} -> Logger.warning("Castmill OS release import failed: #{inspect(reason)}")
    end

    Process.send_after(self(), :import, interval())
    {:noreply, state}
  end

  defp interval do
    Keyword.get(
      Application.get_env(:castmill, Castmill.OsUpdates, []),
      :import_interval,
      :timer.hours(1)
    )
  end
end
