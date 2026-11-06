defmodule Castmill.Widgets.Integrations.ChoicesStore do
  @moduledoc """
  Short-lived cache for widget option choice lookups.

  The cache is a public ETS table owned by this process, so reads never go
  through the GenServer. If the table does not exist (the process is not
  running), lookups miss.
  """

  use GenServer

  @cache __MODULE__.Cache
  @prune_ms 60_000

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, :ok, name: __MODULE__)
  end

  @doc "Returns `{:ok, value}` for a cached, unexpired key, or `:miss`."
  def get(key) do
    now = now_ms()

    case :ets.lookup(@cache, key) do
      [{^key, expires_at, value}] when expires_at > now -> {:ok, value}
      _ -> :miss
    end
  rescue
    ArgumentError -> :miss
  end

  @doc "Caches a value for `ttl_ms` milliseconds."
  def put(key, value, ttl_ms) when is_integer(ttl_ms) and ttl_ms > 0 do
    :ets.insert(@cache, {key, now_ms() + ttl_ms, value})
    :ok
  rescue
    ArgumentError -> :ok
  end

  def put(_key, _value, _ttl_ms), do: :ok

  @doc """
  Counts a choices request for `actor_id` (see `Castmill.RateLimiter.allow/3`).
  """
  def allow(actor_id, limit, window_ms \\ 60_000),
    do: Castmill.RateLimiter.allow({:choices, actor_id}, limit, window_ms)

  @doc false
  def clear do
    :ets.delete_all_objects(@cache)
    Castmill.RateLimiter.clear()
  rescue
    ArgumentError -> :ok
  end

  @impl true
  def init(:ok) do
    :ets.new(@cache, [:named_table, :set, :public, read_concurrency: true])
    schedule_prune()
    {:ok, nil}
  end

  @impl true
  def handle_info(:prune, state) do
    prune(now_ms())
    schedule_prune()
    {:noreply, state}
  end

  @doc false
  def prune(now) do
    :ets.select_delete(@cache, [{{:_, :"$1", :_}, [{:"=<", :"$1", now}], [true]}])
    :ok
  end

  defp schedule_prune, do: Process.send_after(self(), :prune, @prune_ms)

  defp now_ms, do: System.system_time(:millisecond)
end
