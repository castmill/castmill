defmodule Castmill.DeviceErrorRateLimiter do
  @moduledoc false

  use GenServer

  @table __MODULE__
  @window_ms 60_000
  @max_reports_per_window 120

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, :ok, name: __MODULE__)
  end

  def allow(device_id, report_count)
      when is_binary(device_id) and is_integer(report_count) and report_count >= 0 do
    GenServer.call(__MODULE__, {:allow, device_id, report_count})
  end

  @impl true
  def init(:ok) do
    table = :ets.new(@table, [:named_table, :set, :protected])
    schedule_prune()
    {:ok, table}
  end

  @impl true
  def handle_call({:allow, device_id, report_count}, _from, table) do
    now = System.monotonic_time(:millisecond)

    result =
      case :ets.lookup(table, device_id) do
        [{^device_id, window_started_at, used_count}]
        when now - window_started_at < @window_ms and
               used_count + report_count > @max_reports_per_window ->
          {:error, :error_report_rate_limited}

        [{^device_id, window_started_at, used_count}]
        when now - window_started_at < @window_ms ->
          :ets.insert(table, {device_id, window_started_at, used_count + report_count})
          :ok

        _ ->
          :ets.insert(table, {device_id, now, report_count})
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
