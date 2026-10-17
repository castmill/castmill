defmodule Castmill.LegacyPlayerLogRateLimiter do
  @moduledoc false

  use GenServer

  @table __MODULE__
  @window_ms 60_000
  @max_logs_per_window 60

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, :ok, name: __MODULE__)
  end

  def allow(source_ip) when is_tuple(source_ip) do
    GenServer.call(__MODULE__, {:allow, source_ip})
  end

  @impl true
  def init(:ok) do
    table = :ets.new(@table, [:named_table, :set, :protected])
    schedule_prune()
    {:ok, table}
  end

  @impl true
  def handle_call({:allow, source_ip}, _from, table) do
    now = System.monotonic_time(:millisecond)

    result =
      case :ets.lookup(table, source_ip) do
        [{^source_ip, window_started_at, used_count}]
        when now - window_started_at < @window_ms and used_count >= @max_logs_per_window ->
          {:error, :rate_limited}

        [{^source_ip, window_started_at, used_count}]
        when now - window_started_at < @window_ms ->
          :ets.insert(table, {source_ip, window_started_at, used_count + 1})
          :ok

        _ ->
          :ets.insert(table, {source_ip, now, 1})
          :ok
      end

    {:reply, result, table}
  end

  @impl true
  def handle_info(:prune, table) do
    cutoff = System.monotonic_time(:millisecond) - @window_ms

    :ets.select_delete(table, [
      {{:"$1", :"$2", :"$3"}, [{:<, :"$2", cutoff}], [true]}
    ])

    schedule_prune()
    {:noreply, table}
  end

  defp schedule_prune do
    Process.send_after(self(), :prune, @window_ms)
  end
end
