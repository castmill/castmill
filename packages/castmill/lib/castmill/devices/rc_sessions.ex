defmodule Castmill.Devices.RcSessions do
  @moduledoc """
  Context for managing remote control sessions.

  Handles session lifecycle management with proper state machine transitions,
  timeout logic, and ensures only one active session per device.
  """
  require Logger
  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Devices.RcSession
  alias Castmill.Devices.RcRelaySupervisor
  alias Castmill.Devices.RcLogger
  alias Castmill.Devices.RcTelemetry

  # Default timeout for idle sessions (5 minutes)
  @default_timeout_seconds 300

  @doc """
  Creates a new RC session for a device and user in the 'created' state.

  If the device already has an active session, it will be automatically terminated
  before creating the new session.
  """
  def create_session(device_id, user_id, opts \\ []) do
    timeout_seconds = Keyword.get(opts, :timeout_seconds, @default_timeout_seconds)
    Logger.info("create_session called for device_id=#{device_id}, user_id=#{user_id}")

    # First, terminate any existing active session for this device (outside transaction)
    existing = get_active_session_for_device(device_id)
    Logger.info("create_session: existing active session for device=#{inspect(existing && existing.id)}")

    case existing do
      nil ->
        Logger.info("create_session: no existing session to terminate")
        :ok

      existing_session ->
        Logger.info("create_session: terminating existing session #{existing_session.id} (state=#{existing_session.state})")
        RcLogger.info("Terminating existing session before creating new one", existing_session.id, device_id, [
          user_id: user_id,
          existing_state: existing_session.state
        ])

        # Terminate the existing session - this will broadcast to the device
        terminate_session_forcefully(existing_session.id)
        Logger.info("create_session: existing session #{existing_session.id} terminated")
    end

    # Use a transaction to ensure atomicity of session creation and relay startup
    Logger.info("create_session: starting transaction")
    Repo.transaction(fn ->
      # Double-check no active session exists (race condition protection)
      double_check = get_active_session_for_device(device_id)
      Logger.info("create_session: double-check active session=#{inspect(double_check && double_check.id)}")

      case double_check do
        nil ->
          # Truncate to seconds since :utc_datetime doesn't support microseconds
          now = DateTime.utc_now() |> DateTime.truncate(:second)

          attrs = %{
            device_id: device_id,
            user_id: user_id,
            state: "created",
            status: "active",  # Keep for backward compatibility (DEPRECATED)
            started_at: now,
            last_activity_at: now,
            timeout_at: nil  # Will be computed dynamically from last_activity_at + timeout_seconds
          }

          case %RcSession{}
               |> RcSession.changeset(attrs)
               |> Repo.insert() do
            {:ok, session} ->
              Logger.info("create_session: session #{session.id} inserted successfully")
              # Log session creation
              RcLogger.info("RC session created", session.id, device_id, [
                user_id: user_id,
                timeout_seconds: timeout_seconds
              ])

              # Emit telemetry event
              RcTelemetry.session_created(session.id, device_id, user_id)

              # Start the relay for this session
              case RcRelaySupervisor.start_relay(session.id) do
                {:ok, _pid} ->
                  Logger.info("create_session: relay started for session #{session.id}")
                  # Schedule timeout check
                  schedule_timeout_check(session.id, timeout_seconds)
                  # Return session with computed timeout_at for API response
                  timeout_at = DateTime.add(now, timeout_seconds, :second)
                  Logger.info("create_session: returning session #{session.id} successfully")
                  %{session | timeout_at: timeout_at}

                {:error, reason} ->
                  Logger.error("create_session: failed to start relay for session #{session.id}: #{inspect(reason)}")
                  # Log and emit telemetry for relay failure
                  RcLogger.error("Failed to start relay for RC session", session.id, device_id, [
                    reason: inspect(reason)
                  ])
                  RcTelemetry.relay_start_failed(session.id, device_id, reason)
                  # Rollback transaction if relay fails to start
                  Repo.rollback(reason)
              end

            {:error, changeset} ->
              Logger.error("create_session: failed to insert session: #{inspect(changeset.errors)}")
              Repo.rollback(changeset)
          end

        existing_in_tx ->
          # This should rarely happen - only in race conditions
          Logger.warning("create_session: found active session in transaction - race condition! session=#{existing_in_tx.id}")
          Repo.rollback(:device_has_active_session)
      end
    end)
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
    # Log caller to debug unexpected closures
    Logger.info("transition_to_closed called for #{session_id}, caller: #{inspect(Process.info(self(), :current_stacktrace))}")

    case transition_state(session_id, "closed") do
      {:ok, session} ->
        # Calculate duration if started_at is available
        duration_ms =
          if session.started_at do
            DateTime.diff(DateTime.utc_now(), session.started_at, :millisecond)
          else
            0
          end

        # Log session closure
        RcLogger.info("RC session closed", session_id, session.device_id, [
          duration_ms: duration_ms,
          final_state: "closed"
        ])

        # Emit telemetry event
        RcTelemetry.session_closed(session_id, session.device_id, duration_ms)

        # Stop the relay
        RcRelaySupervisor.stop_relay(session_id)

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
          # Truncate to seconds since :utc_datetime doesn't support microseconds
          now = DateTime.utc_now() |> DateTime.truncate(:second)

          result =
            session
            |> Ecto.Changeset.change(%{last_activity_at: now})
            |> Repo.update()

          # Emit telemetry for activity
          RcTelemetry.session_activity(session_id, session.device_id)

          result
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

  Transitions through stopping to closed state, or directly to closed if in created state.
  """
  def stop_session(session_id) do
    # Log the caller to help debug who is closing sessions
    Logger.info("stop_session called for #{session_id}, caller: #{inspect(Process.info(self(), :current_stacktrace))}")

    case get_session(session_id) do
      nil ->
        {:error, :not_found}

      session ->
        Logger.info("stop_session: session state is #{session.state}")

        # If session is in "created" state, go directly to closed
        # because created -> stopping is not a valid transition
        if session.state == "created" do
          transition_to_closed(session_id)
        else
          # Normal flow: stopping -> closed
          with {:ok, _session} <- transition_to_stopping(session_id),
               {:ok, session} <- transition_to_closed(session_id) do
            {:ok, session}
          else
            # If transition to stopping fails, try direct to closed
            {:error, _reason} -> transition_to_closed(session_id)
          end
        end
    end
  end

  @doc """
  Forcefully terminates an RC session, notifying the device.

  This is used when creating a new session for a device that already has an active session.
  It ensures the device is notified to stop any ongoing capture and return to standby.
  """
  def terminate_session_forcefully(session_id) do
    case get_session(session_id) do
      nil ->
        {:error, :not_found}

      session ->
        # Log the forceful termination
        RcLogger.info("Forcefully terminating RC session", session_id, session.device_id, [
          previous_state: session.state,
          reason: "new_session_requested"
        ])

        # Broadcast stop_session to the device so it knows to stop capture
        CastmillWeb.Endpoint.broadcast(
          "rc_device:#{session.device_id}",
          "stop_session",
          %{session_id: session_id, reason: "replaced_by_new_session"}
        )

        # Also broadcast to the window channel if any dashboard is watching
        CastmillWeb.Endpoint.broadcast(
          "rc_window:#{session_id}",
          "session_closed",
          %{reason: "replaced_by_new_session"}
        )

        # Stop the relay if it's running
        RcRelaySupervisor.stop_relay(session_id)

        # Transition directly to closed state
        transition_to_closed(session_id)
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
  Timeout is based on last_activity_at + default_timeout_seconds.
  Also cleans up sessions where last_activity_at is nil but inserted_at is older than timeout.
  """
  def check_and_close_timed_out_sessions(timeout_seconds \\ @default_timeout_seconds) do
    now = DateTime.utc_now()
    timeout_threshold = DateTime.add(now, -timeout_seconds, :second)

    # Find sessions timed out by last_activity_at OR inserted_at (for sessions that never had activity)
    timed_out_sessions =
      RcSession
      |> where([s], s.state in ^RcSession.active_states())
      |> where([s],
        (not is_nil(s.last_activity_at) and s.last_activity_at < ^timeout_threshold) or
        (is_nil(s.last_activity_at) and s.inserted_at < ^timeout_threshold)
      )
      |> Repo.all()

    Enum.each(timed_out_sessions, fn session ->
      # Log timeout alert
      RcLogger.warning("RC session timed out", session.id, session.device_id, [
        state: session.state,
        last_activity_at: session.last_activity_at,
        timeout_seconds: timeout_seconds
      ])

      # Emit telemetry for timeout
      RcTelemetry.session_timeout(session.id, session.device_id, session.state)

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
  Timeout is based on last_activity_at + timeout_seconds.
  """
  def check_session_timeout(session_id, timeout_seconds \\ @default_timeout_seconds) do
    case get_session(session_id) do
      nil ->
        {:error, :not_found}

      session ->
        if RcSession.active_state?(session.state) && session_timed_out?(session, timeout_seconds) do
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
        old_state = session.state

        result =
          session
          |> RcSession.state_transition_changeset(new_state)
          |> Repo.update()

        # Log and emit telemetry for successful transitions
        case result do
          {:ok, updated_session} ->
            RcLogger.info("RC session state transition", session_id, session.device_id, [
              from_state: old_state,
              to_state: new_state
            ])

            RcTelemetry.session_state_transition(
              session_id,
              session.device_id,
              old_state,
              new_state
            )

            {:ok, updated_session}

          error ->
            error
        end
    end
  end

  defp session_timed_out?(session, timeout_seconds \\ @default_timeout_seconds) do
    case session.last_activity_at do
      nil -> false
      last_activity_at ->
        timeout_threshold = DateTime.add(DateTime.utc_now(), -timeout_seconds, :second)
        DateTime.compare(last_activity_at, timeout_threshold) == :lt
    end
  end

  defp schedule_timeout_check(session_id, timeout_seconds) do
    # Add a small buffer to the timeout check
    check_after_ms = (timeout_seconds + 10) * 1000

    Task.start(fn ->
      Process.sleep(check_after_ms)
      check_session_timeout(session_id, timeout_seconds)
    end)
  end
end
