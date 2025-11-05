defmodule CastmillWeb.RcSessionController do
  @moduledoc """
  Controller for managing remote control sessions.
  """
  use CastmillWeb, :controller

  alias Castmill.Devices
  alias Castmill.Devices.RcSessions

  action_fallback CastmillWeb.FallbackController

  @doc """
  Creates a new RC session for a device.
  
  POST /devices/:device_id/rc/sessions
  """
  def create(conn, %{"device_id" => device_id}) do
    # Get the current user from conn assigns
    user_id = conn.assigns[:current_user][:id]

    if is_nil(user_id) do
      conn
      |> put_status(:unauthorized)
      |> json(%{error: "Unauthorized"})
    else
      # Verify the device exists
      case Devices.get_device(device_id) do
        nil ->
          conn
          |> put_status(:not_found)
          |> json(%{error: "Device not found"})

        device ->
          # Check if there's already an active session for this device
          case RcSessions.get_active_session_for_device(device_id) do
            nil ->
              # Create a new session
              case RcSessions.create_session(device_id, user_id) do
                {:ok, session} ->
                  conn
                  |> put_status(:created)
                  |> json(%{
                    session_id: session.id,
                    device_id: session.device_id,
                    status: session.status,
                    started_at: session.started_at
                  })

                {:error, changeset} ->
                  conn
                  |> put_status(:unprocessable_entity)
                  |> json(%{error: "Failed to create session", details: changeset.errors})
              end

            _active_session ->
              conn
              |> put_status(:conflict)
              |> json(%{error: "Device already has an active RC session"})
          end
      end
    end
  end

  @doc """
  Stops an RC session.
  
  POST /rc/sessions/:session_id/stop
  """
  def stop(conn, %{"session_id" => session_id}) do
    user_id = conn.assigns[:current_user][:id]

    if is_nil(user_id) do
      conn
      |> put_status(:unauthorized)
      |> json(%{error: "Unauthorized"})
    else
      case RcSessions.get_session(session_id) do
        nil ->
          conn
          |> put_status(:not_found)
          |> json(%{error: "Session not found"})

        session ->
          # Verify the session belongs to the current user
          if session.user_id != user_id do
            conn
            |> put_status(:forbidden)
            |> json(%{error: "Not authorized to stop this session"})
          else
            case RcSessions.stop_session(session_id) do
              {:ok, stopped_session} ->
                # Notify connected clients that session is stopped
                Phoenix.PubSub.broadcast(
                  Castmill.PubSub,
                  "rc_session:#{session_id}",
                  %{event: "stop_session"}
                )

                conn
                |> put_status(:ok)
                |> json(%{
                  session_id: stopped_session.id,
                  status: stopped_session.status,
                  stopped_at: stopped_session.stopped_at
                })

              {:error, :not_found} ->
                conn
                |> put_status(:not_found)
                |> json(%{error: "Session not found"})

              {:error, changeset} ->
                conn
                |> put_status(:unprocessable_entity)
                |> json(%{error: "Failed to stop session", details: changeset.errors})
            end
          end
      end
    end
  end

  @doc """
  Gets the RC status for a device.
  
  GET /devices/:device_id/rc/status
  """
  def status(conn, %{"device_id" => device_id}) do
    # Verify the device exists
    case Devices.get_device(device_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Device not found"})

      _device ->
        status = RcSessions.get_device_rc_status(device_id)

        response =
          if status.has_active_session do
            %{
              has_active_session: true,
              session_id: status.session.id,
              user_id: status.session.user_id,
              started_at: status.session.started_at
            }
          else
            %{has_active_session: false}
          end

        conn
        |> put_status(:ok)
        |> json(response)
    end
  end
end
