defmodule CastmillWeb.ChallengeStore do
  @moduledoc """
  Database-backed, single-use challenge store for WebAuthn authentication.

  Challenges are stored when issued and deleted on first successful
  verification, preventing replay attacks within the token TTL window.

  Uses PostgreSQL for persistence so that challenges are shared across
  all application nodes behind a load balancer. Consumption performs an
  atomic `DELETE ... WHERE` and checks the affected-row count, ensuring
  exactly-once semantics even under concurrent requests.

  A periodic sweep removes expired entries to bound table size.
  """
  use GenServer

  import Ecto.Query
  alias Castmill.Repo

  # Challenge TTL in seconds — single source of truth used by both
  # the DB store and the signed token (via challenge_ttl_seconds/0).
  @challenge_ttl_seconds 300

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
    expires_at = DateTime.add(DateTime.utc_now(), @challenge_ttl_seconds, :second)

    Repo.insert_all(
      "webauthn_challenges",
      [%{challenge: challenge, expires_at: expires_at}],
      on_conflict: :nothing
    )

    :ok
  end

  @doc """
  Consume a challenge atomically.

  Returns `true` if the challenge existed and was not expired (and is now
  deleted), or `false` otherwise. After returning `true` once, subsequent
  calls with the same challenge will return `false`.

  Uses an atomic `DELETE ... WHERE` and checks the affected-row count
  for multi-node-safe, single-use enforcement.
  """
  @spec consume(String.t()) :: boolean()
  def consume(challenge) when is_binary(challenge) do
    now = DateTime.utc_now()

    {count, _} =
      from(c in "webauthn_challenges",
        where: c.challenge == ^challenge and c.expires_at > ^now
      )
      |> Repo.delete_all()

    count > 0
  end

  # ── GenServer (periodic cleanup only) ───────────────────────────────

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    schedule_sweep()
    {:ok, %{}}
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
    now = DateTime.utc_now()

    from(c in "webauthn_challenges", where: c.expires_at <= ^now)
    |> Repo.delete_all()
  end
end
