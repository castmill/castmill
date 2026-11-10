defmodule Castmill.RateLimiter do
  @moduledoc """
  Fixed-window request counters kept in a public ETS table, so checks never go
  through the GenServer. When the table does not exist (the process is not
  running), requests are allowed.

      :ok = Castmill.RateLimiter.allow({:feed_token, id}, 60)
  """

  use GenServer

  @table __MODULE__
  @prune_ms 60_000

  def start_link(_opts), do: GenServer.start_link(__MODULE__, :ok, name: __MODULE__)

  @doc """
  Counts a request for `key` and returns `:ok` while at most `limit` requests
  were made in the current window of `window_ms` milliseconds, or
  `{:error, :rate_limited}`.
  """
  def allow(key, limit, window_ms \\ 60_000)
      when is_integer(limit) and is_integer(window_ms) and window_ms > 0 do
    counter = {key, div(now_ms(), window_ms), window_ms}
    count = :ets.update_counter(@table, counter, {2, 1}, {counter, 0})

    if count <= limit, do: :ok, else: {:error, :rate_limited}
  rescue
    ArgumentError -> :ok
  end

  @doc false
  def clear do
    :ets.delete_all_objects(@table)
    :ok
  rescue
    ArgumentError -> :ok
  end

  @impl true
  def init(:ok) do
    :ets.new(@table, [:named_table, :set, :public, write_concurrency: true])
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
    # Keys are {key, window_index, window_ms}; drop windows that have ended.
    :ets.select_delete(@table, [
      {{{:_, :"$1", :"$2"}, :_}, [{:"=<", {:*, {:+, :"$1", 1}, :"$2"}, now}], [true]}
    ])

    :ok
  end

  defp schedule_prune, do: Process.send_after(self(), :prune, @prune_ms)

  defp now_ms, do: System.system_time(:millisecond)
end
