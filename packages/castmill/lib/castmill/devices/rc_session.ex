defmodule Castmill.Devices.RcSession do
  @moduledoc """
  Schema for remote control sessions.

  An RC session represents an active remote control connection from a dashboard user
  to a device. It manages the WebSocket connections between the device, the media relay,
  and the RC window in the dashboard.

  ## Session States

  - `created` - Session initialized but not yet started
  - `starting` - Device or RC window is connecting
  - `streaming` - Active session with both connections established
  - `stopping` - Session is being torn down
  - `closed` - Session fully terminated

  ## State Transitions

  - `created` → `starting` - When first connection (device or window) joins
  - `starting` → `streaming` - When both device and window are connected
  - `streaming` → `stopping` - When stop is requested
  - `stopping` → `closed` - When cleanup is complete
  - Any state → `closed` - On timeout or error

  ## Fields

  - `status` - **DEPRECATED** Legacy field kept for backward compatibility during migration.
              Will be removed in a future version. Use `state` field instead.
  """
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  # Session states
  @states ~w(created starting streaming stopping closed)
  @active_states ~w(created starting streaming)

  schema "rc_sessions" do
    field :device_id, :binary_id
    field :user_id, :binary_id

    # Legacy field - keep for backward compatibility during migration
    field :status, :string

    # New state machine fields
    field :state, :string, default: "created"
    field :started_at, :utc_datetime
    field :stopped_at, :utc_datetime
    field :timeout_at, :utc_datetime
    field :last_activity_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @doc """
  Returns the list of all possible session states.
  """
  def states, do: @states

  @doc """
  Returns the list of active session states (not closed).
  """
  def active_states, do: @active_states

  @doc """
  Checks if a state is an active state.
  """
  def active_state?(state), do: state in @active_states

  @doc """
  Validates if a state transition is allowed.

  ## Valid Transitions
  - created → starting
  - starting → streaming
  - streaming → stopping
  - stopping → closed
  - Any state → closed (for timeout/error cases)
  """
  def valid_transition?(from_state, to_state) do
    case {from_state, to_state} do
      {"created", "starting"} -> true
      {"starting", "streaming"} -> true
      {"streaming", "stopping"} -> true
      {"stopping", "closed"} -> true
      {_, "closed"} -> true  # Can always transition to closed
      _ -> false
    end
  end

  @doc """
  Changeset for creating a new RC session.
  """
  def changeset(rc_session, attrs) do
    rc_session
    |> cast(attrs, [:device_id, :user_id, :state, :status, :started_at, :stopped_at, :timeout_at, :last_activity_at])
    |> validate_required([:device_id, :user_id])
    |> validate_inclusion(:state, @states)
    |> validate_state_transition()
  end

  @doc """
  Changeset for state transitions with validation.
  """
  def state_transition_changeset(rc_session, new_state, attrs \\ %{}) do
    attrs = Map.put(attrs, :state, new_state)

    rc_session
    |> cast(attrs, [:state, :started_at, :stopped_at, :timeout_at, :last_activity_at])
    |> validate_required([:state])
    |> validate_inclusion(:state, @states)
    |> validate_state_transition()
    |> maybe_set_timestamps(new_state)
  end

  # Private functions

  defp validate_state_transition(changeset) do
    case get_change(changeset, :state) do
      nil ->
        changeset

      new_state ->
        old_state = get_field(changeset, :state)

        if old_state && !valid_transition?(old_state, new_state) do
          add_error(
            changeset,
            :state,
            "invalid state transition from #{old_state} to #{new_state}"
          )
        else
          changeset
        end
    end
  end

  defp maybe_set_timestamps(changeset, new_state) do
    # Truncate to seconds since :utc_datetime doesn't support microseconds
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    case new_state do
      "starting" ->
        changeset
        |> put_change(:started_at, get_field(changeset, :started_at) || now)
        |> put_change(:last_activity_at, now)

      "streaming" ->
        changeset
        |> put_change(:last_activity_at, now)

      "closed" ->
        changeset
        |> put_change(:stopped_at, get_field(changeset, :stopped_at) || now)
        |> put_change(:last_activity_at, now)

      _ ->
        changeset
        |> put_change(:last_activity_at, now)
    end
  end
end
