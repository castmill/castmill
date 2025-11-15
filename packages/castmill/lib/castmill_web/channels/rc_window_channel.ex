defmodule CastmillWeb.RcWindowChannel do
  @moduledoc """
  WebSocket channel for remote control window in the dashboard.
  
  This channel handles the dashboard side of remote control sessions.
  Dashboard users connect to this channel to control devices and receive
  media streams.
  
  Requires device_manager role or higher (admin, manager).
  
  Topics: "rc_window:#{session_id}"
  """
  use CastmillWeb, :channel

  alias Castmill.Devices
  alias Castmill.Devices.RcSessions
  alias Castmill.Devices.RcRelay
  alias Castmill.Organizations

  @impl true
  def join("rc_window:" <> session_id, _params, socket) do
    # Get user from socket assigns (set by RcSocket authenticate_user)
    user = socket.assigns[:user]

    if is_nil(user) do
      {:error, %{reason: "Unauthorized"}}
    else
      # Verify the session exists and belongs to this user
      case RcSessions.get_session(session_id) do
        nil ->
          {:error, %{reason: "Session not found"}}

        session ->
          # Get the device to check organization and permissions
          device = Devices.get_device(session.device_id)

          if is_nil(device) do
            {:error, %{reason: "Device not found"}}
          else
            # Check if user has device_manager role or higher
            user_role = Organizations.get_user_role(device.organization_id, user.id)

            if has_rc_permission?(user_role) do
              # Re-fetch session to avoid race conditions and use latest state
              current_session = RcSessions.get_session(session_id)

              if current_session && 
                 current_session.user_id == user.id and
                 current_session.state in ["created", "starting", "streaming"] do
                # Subscribe to session PubSub topic to receive device events
                Phoenix.PubSub.subscribe(Castmill.PubSub, "rc_session:#{session_id}")

                # Transition session to starting if it's still in created state
                if current_session.state == "created" do
                  RcSessions.transition_to_starting(session_id)
                end

                # Update activity timestamp
                RcSessions.update_activity(session_id)

                socket =
                  socket
                  |> assign(:session_id, session_id)
                  |> assign(:device_id, current_session.device_id)

                {:ok, socket}
              else
                {:error, %{reason: "Unauthorized or invalid session"}}
              end
            else
              {:error,
               %{
                 reason:
                   "Insufficient permissions. device_manager role or higher required for remote control."
               }}
            end
          end
      end
    end
  end

  @impl true
  def handle_in("control_event", payload, socket) do
    # Forward control events to device via relay with queue management
    session_id = socket.assigns.session_id

    case RcRelay.enqueue_control_event(session_id, payload) do
      :ok ->
        # Update activity timestamp
        RcSessions.update_activity(session_id)
        {:reply, :ok, socket}

      {:error, :queue_full} ->
        {:reply, {:error, %{reason: "Control queue full, try again"}}, socket}

      {:error, :invalid_message} ->
        {:reply, {:error, %{reason: "Invalid control event message"}}, socket}

      {:error, :session_not_found} ->
        {:reply, {:error, %{reason: "Session not found"}}, socket}

      {:error, reason} when is_atom(reason) ->
        {:reply, {:error, %{reason: Atom.to_string(reason)}}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  @impl true
  def handle_in("request_metadata", _payload, socket) do
    # Request updated metadata from device
    session_id = socket.assigns.session_id

    Phoenix.PubSub.broadcast(
      Castmill.PubSub,
      "rc_session:#{session_id}",
      %{event: "request_metadata"}
    )

    # Update activity timestamp
    RcSessions.update_activity(session_id)

    {:reply, :ok, socket}
  end

  # Handle messages from PubSub (from device channels)
  @impl true
  def handle_info(%{event: "device_connected", device_id: device_id}, socket) do
    # When device connects, try to transition to streaming if we're in starting state
    # Re-fetch to ensure we have current state and avoid race conditions
    session_id = socket.assigns.session_id
    
    case RcSessions.get_session(session_id) do
      %{state: "starting"} ->
        RcSessions.transition_to_streaming(session_id)
      _ ->
        :ok
    end

    push(socket, "device_connected", %{device_id: device_id})
    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: "device_disconnected", device_id: device_id}, socket) do
    push(socket, "device_disconnected", %{device_id: device_id})
    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: "device_event", payload: payload}, socket) do
    push(socket, "device_event", payload)
    
    # Update activity timestamp
    RcSessions.update_activity(socket.assigns.session_id)
    
    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: "media_stream_ready", device_id: device_id}, socket) do
    push(socket, "media_stream_ready", %{device_id: device_id})
    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: "media_stream_disconnected", device_id: device_id}, socket) do
    push(socket, "media_stream_disconnected", %{device_id: device_id})
    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: "media_frame", payload: payload, source: :relay}, socket) do
    # Forward media frames from relay to RC window
    push(socket, "media_frame", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: "media_frame", payload: payload}, socket) do
    # Legacy direct PubSub (backward compatibility)
    push(socket, "media_frame", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: "media_metadata", payload: payload}, socket) do
    push(socket, "media_metadata", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: "session_closed"}, socket) do
    # Session closed (timeout or explicit), disconnect window
    push(socket, "session_closed", %{})
    {:stop, :normal, socket}
  end

  @impl true
  def terminate(_reason, socket) do
    # Unsubscribe from PubSub when disconnecting
    session_id = socket.assigns[:session_id]

    if session_id do
      Phoenix.PubSub.unsubscribe(Castmill.PubSub, "rc_session:#{session_id}")
    end

    :ok
  end

  # Private helper functions

  defp has_rc_permission?(role) do
    # device_manager, manager, and admin roles can use RC features
    role in [:device_manager, :manager, :admin]
  end
end
