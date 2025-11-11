defmodule CastmillWeb.RcSessionController do
  @moduledoc """
  Controller for managing remote control sessions.
  
  Requires device_manager role or higher (admin, manager) for all RC operations.
  """
  use CastmillWeb, :controller

  alias Castmill.Devices
  alias Castmill.Devices.RcSessions
  alias Castmill.Organizations

  action_fallback CastmillWeb.FallbackController

  @doc """
  Creates a new RC session for a device.
  
  POST /devices/:device_id/rc/sessions
  
  Requires device_manager role or higher.
  """
  def create(conn, %{"device_id" => device_id}) do
    # Get the current user from conn assigns
    user_id = get_in(conn.assigns, [:current_user, :id])

    if is_nil(user_id) do
      conn
      |> put_status(:unauthorized)
      |> json(%{error: "Unauthorized"})
    else
      # Verify the device exists and check permissions
      case Devices.get_device(device_id) do
        nil ->
          conn
          |> put_status(:not_found)
          |> json(%{error: "Device not found"})

        device ->
          # Check if user has permission to manage devices (device_manager role or higher)
          user_role = Organizations.get_user_role(device.organization_id, user_id)

          if has_rc_permission?(user_role) do
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
                      state: session.state,
                      started_at: session.started_at,
                      timeout_at: session.timeout_at
                    })

                  {:error, :device_has_active_session} ->
                    conn
                    |> put_status(:conflict)
                    |> json(%{error: "Device already has an active RC session"})

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
          else
            conn
            |> put_status(:forbidden)
            |> json(%{error: "Insufficient permissions. device_manager role or higher required for remote control."})
          end
      end
    end
  end

  @doc """
  Stops an RC session.
  
  POST /rc/sessions/:session_id/stop
  
  Requires device_manager role or higher, and user must own the session.
  """
  def stop(conn, %{"session_id" => session_id}) do
    user_id = get_in(conn.assigns, [:current_user, :id])

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
          # Get the device to check organization
          device = Devices.get_device(session.device_id)

          if device do
            # Check permissions
            user_role = Organizations.get_user_role(device.organization_id, user_id)

            if has_rc_permission?(user_role) do
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
                      state: stopped_session.state,
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
            else
              conn
              |> put_status(:forbidden)
              |> json(%{error: "Insufficient permissions. device_manager role or higher required for remote control."})
            end
          else
            conn
            |> put_status(:not_found)
            |> json(%{error: "Device not found"})
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
              state: status.session.state,
              started_at: status.session.started_at,
              timeout_at: status.session.timeout_at
            }
          else
            %{has_active_session: false}
          end

        conn
        |> put_status(:ok)
        |> json(response)
    end
  end

  # Private helper functions

  defp has_rc_permission?(role) do
    # device_manager, manager, and admin roles can use RC features
    role in [:device_manager, :manager, :admin]
  end
end
