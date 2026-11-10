defmodule Castmill.Widgets.Integrations.ChoicesStore do
  @moduledoc """
  Short-lived cache and per-actor rate limit for widget option choice lookups.

  Both live in public ETS tables owned by this process, so reads and counter
  updates never go through the GenServer. If the tables do not exist (the
  process is not running), lookups miss and requests are allowed.
  """

  use GenServer

  @cache __MODULE__.Cache
  @rate __MODULE__.Rate
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
  Counts a request for `actor_id` and returns `:ok` while at most `limit`
  requests were made in the current fixed window of `window_ms` milliseconds.
  """
  def allow(actor_id, limit, window_ms \\ 60_000)
      when is_integer(limit) and is_integer(window_ms) and window_ms > 0 do
    key = {actor_id, div(now_ms(), window_ms), window_ms}
    count = :ets.update_counter(@rate, key, {2, 1}, {key, 0})

    if count <= limit, do: :ok, else: {:error, :rate_limited}
  rescue
    ArgumentError -> :ok
  end

  @doc false
  def clear do
    :ets.delete_all_objects(@cache)
    :ets.delete_all_objects(@rate)
    :ok
  rescue
    ArgumentError -> :ok
  end

  @impl true
  def init(:ok) do
    :ets.new(@cache, [:named_table, :set, :public, read_concurrency: true])
    :ets.new(@rate, [:named_table, :set, :public, write_concurrency: true])
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

    # Rate keys are {actor, window_index, window_ms}; drop windows that have ended.
    :ets.select_delete(@rate, [
      {{{:_, :"$1", :"$2"}, :_}, [{:"=<", {:*, {:+, :"$1", 1}, :"$2"}, now}], [true]}
    ])

    :ok
  end

  defp schedule_prune, do: Process.send_after(self(), :prune, @prune_ms)

  defp now_ms, do: System.system_time(:millisecond)
end
