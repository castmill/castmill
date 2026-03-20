defmodule CastmillWeb.ChallengeStore do
  @moduledoc """
  ETS-backed, single-use challenge store for WebAuthn authentication.

  Challenges are stored when issued and deleted on first successful
  verification, preventing replay attacks within the token TTL window.
  A periodic sweep removes expired entries to bound memory usage.
  """
  use GenServer

  @table __MODULE__

  # Challenge TTL in seconds — single source of truth used by both
  # the ETS store and the signed token (via challenge_ttl_seconds/0).
  @challenge_ttl_seconds 300

  @default_ttl_ms :timer.seconds(@challenge_ttl_seconds)
  @sweep_interval_ms :timer.minutes(1)

  @doc "Returns the challenge TTL in seconds (single source of truth)."
  @spec challenge_ttl_seconds() :: pos_integer()
  def challenge_ttl_seconds, do: @challenge_ttl_seconds

  # ── Public API ──────────────────────────────────────────────────────

  @doc """
  Store a challenge. Returns `:ok`.
  """
  @spec put(String.t()) :: :ok
  def put(challenge) when is_binary(challenge) do
    expires_at = System.monotonic_time(:millisecond) + @default_ttl_ms
    :ets.insert(@table, {challenge, expires_at})
    :ok
  end

  @doc """
  Consume a challenge atomically.

  Returns `true` if the challenge existed and was not expired (and is now
  deleted), or `false` otherwise. After returning `true` once, subsequent
  calls with the same challenge will return `false`.
  """
  @spec consume(String.t()) :: boolean()
  def consume(challenge) when is_binary(challenge) do
    now = System.monotonic_time(:millisecond)

    case :ets.take(@table, challenge) do
      [{^challenge, expires_at}] when expires_at > now -> true
      _ -> false
    end
  end

  # ── GenServer callbacks ─────────────────────────────────────────────

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    table = :ets.new(@table, [:set, :public, :named_table, read_concurrency: true])
    schedule_sweep()
    {:ok, %{table: table}}
  end

  @impl true
  def handle_info(:sweep, state) do
    sweep_expired()
    schedule_sweep()
    {:noreply, state}
  end

  # ── Internal ────────────────────────────────────────────────────────

  defp schedule_sweep do
    Process.send_after(self(), :sweep, @sweep_interval_ms)
  end

  defp sweep_expired do
    now = System.monotonic_time(:millisecond)
    # Delete all entries whose expires_at <= now
    :ets.select_delete(@table, [{{:_, :"$1"}, [{:"=<", :"$1", now}], [true]}])
  end
end
