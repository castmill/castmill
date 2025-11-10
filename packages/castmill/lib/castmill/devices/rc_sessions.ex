defmodule Castmill.Devices.RcSessions do
  @moduledoc """
  Context for managing remote control sessions.
  
  Handles session lifecycle management with proper state machine transitions,
  timeout logic, and ensures only one active session per device.
  """
  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Devices.RcSession

  # Default timeout for idle sessions (5 minutes)
  @default_timeout_seconds 300

  @doc """
  Creates a new RC session for a device and user in the 'created' state.
  
  Returns an error if the device already has an active session.
  """
  def create_session(device_id, user_id, opts \\ []) do
    timeout_seconds = Keyword.get(opts, :timeout_seconds, @default_timeout_seconds)
    
    # Check for existing active session
    case get_active_session_for_device(device_id) do
      nil ->
        now = DateTime.utc_now()
        timeout_at = DateTime.add(now, timeout_seconds, :second)
        
        attrs = %{
          device_id: device_id,
          user_id: user_id,
          state: "created",
          status: "active",  # Keep for backward compatibility
          last_activity_at: now,
          timeout_at: timeout_at
        }

        result = 
          %RcSession{}
          |> RcSession.changeset(attrs)
          |> Repo.insert()

        case result do
          {:ok, session} ->
            # Schedule timeout check
            schedule_timeout_check(session.id, timeout_seconds)
            {:ok, session}

          error ->
            error
        end

      _existing_session ->
        {:error, :device_has_active_session}
    end
  end

  @doc """
  Transitions a session to the 'starting' state.
  
  This should be called when the first connection (device or RC window) joins.
  """
  def transition_to_starting(session_id) do
    transition_state(session_id, "starting")
  end

  @doc """
  Transitions a session to the 'streaming' state.
  
  This should be called when both device and RC window are connected.
  """
  def transition_to_streaming(session_id) do
    transition_state(session_id, "streaming")
  end

  @doc """
  Transitions a session to the 'stopping' state.
  
  This is called when a stop is explicitly requested.
  """
  def transition_to_stopping(session_id) do
    transition_state(session_id, "stopping")
  end

  @doc """
  Transitions a session to the 'closed' state.
  
  This finalizes the session and marks it as fully terminated.
  """
  def transition_to_closed(session_id) do
    case transition_state(session_id, "closed") do
      {:ok, session} ->
        # Broadcast that session is closed
        Phoenix.PubSub.broadcast(
          Castmill.PubSub,
          "rc_session:#{session_id}",
          %{event: "session_closed"}
        )
        {:ok, session}

      error ->
        error
    end
  end

  @doc """
  Updates the last activity timestamp for a session.
  
  This should be called on any session activity to prevent premature timeout.
  """
  def update_activity(session_id) do
    case get_session(session_id) do
      nil ->
        {:error, :not_found}

      session ->
        if RcSession.active_state?(session.state) do
          session
          |> Ecto.Changeset.change(%{last_activity_at: DateTime.utc_now()})
          |> Repo.update()
        else
          {:ok, session}
        end
    end
  end

  @doc """
  Gets an RC session by ID.
  """
  def get_session(id) do
    Repo.get(RcSession, id)
  end

  @doc """
  Gets an active RC session for a device.
  
  Active states are: created, starting, streaming
  """
  def get_active_session_for_device(device_id) do
    RcSession
    |> where([s], s.device_id == ^device_id and s.state in ^RcSession.active_states())
    |> order_by([s], desc: s.started_at)
    |> limit(1)
    |> Repo.one()
  end

  @doc """
  Stops an RC session (legacy method for backward compatibility).
  
  Transitions through stopping to closed state.
  """
  def stop_session(session_id) do
    with {:ok, session} <- transition_to_stopping(session_id),
         {:ok, session} <- transition_to_closed(session_id) do
      {:ok, session}
    else
      error -> error
    end
  end

  @doc """
  Gets the status of active RC session for a device.
  """
  def get_device_rc_status(device_id) do
    case get_active_session_for_device(device_id) do
      nil ->
        %{has_active_session: false, session: nil}

      session ->
        %{has_active_session: true, session: session}
    end
  end

  @doc """
  Checks for timed-out sessions and closes them.
  
  This is called by the timeout checker process.
  """
  def check_and_close_timed_out_sessions do
    now = DateTime.utc_now()

    timed_out_sessions =
      RcSession
      |> where([s], s.state in ^RcSession.active_states())
      |> where([s], not is_nil(s.timeout_at) and s.timeout_at < ^now)
      |> Repo.all()

    Enum.each(timed_out_sessions, fn session ->
      case transition_to_closed(session.id) do
        {:ok, _} ->
          :ok

        {:error, reason} ->
          require Logger
          Logger.warning("Failed to close timed-out session #{session.id}: #{inspect(reason)}")
      end
    end)

    length(timed_out_sessions)
  end

  @doc """
  Checks a specific session for timeout and closes it if needed.
  """
  def check_session_timeout(session_id) do
    case get_session(session_id) do
      nil ->
        {:error, :not_found}

      session ->
        if RcSession.active_state?(session.state) && session_timed_out?(session) do
          transition_to_closed(session_id)
        else
          {:ok, session}
        end
    end
  end

  # Private functions

  defp transition_state(session_id, new_state) do
    case get_session(session_id) do
      nil ->
        {:error, :not_found}

      session ->
        session
        |> RcSession.state_transition_changeset(new_state)
        |> Repo.update()
    end
  end

  defp session_timed_out?(session) do
    case session.timeout_at do
      nil -> false
      timeout_at -> DateTime.compare(DateTime.utc_now(), timeout_at) == :gt
    end
  end

  defp schedule_timeout_check(session_id, timeout_seconds) do
    # Add a small buffer to the timeout check
    check_after_ms = (timeout_seconds + 10) * 1000

    Task.start(fn ->
      Process.sleep(check_after_ms)
      check_session_timeout(session_id)
    end)
  end
end
