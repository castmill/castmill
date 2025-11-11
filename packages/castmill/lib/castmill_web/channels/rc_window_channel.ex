defmodule CastmillWeb.RcWindowChannel do
  @moduledoc """
  WebSocket channel for remote control window in the dashboard.
  
  This channel handles the dashboard side of remote control sessions.
  Dashboard users connect to this channel to control devices and receive
  media streams.
  
  Topics: "rc_window:#{session_id}"
  """
  use CastmillWeb, :channel

  alias Castmill.Devices.RcSessions

  @impl true
  def join("rc_window:" <> session_id, _params, socket) do
    # Get user from socket assigns (set by UserSocket)
    user_id = socket.assigns[:user_id]

    if is_nil(user_id) do
      {:error, %{reason: "Unauthorized"}}
    else
      # Verify the session exists and belongs to this user
      case RcSessions.get_session(session_id) do
        nil ->
          {:error, %{reason: "Session not found"}}

        session ->
          if session.user_id == user_id and session.state in ["created", "starting", "streaming"] do
            # Subscribe to session PubSub topic to receive device events
            Phoenix.PubSub.subscribe(Castmill.PubSub, "rc_session:#{session_id}")

            # Transition session to starting if it's still in created state
            # Re-fetch to avoid race conditions
            current_session = RcSessions.get_session(session_id)
            if current_session && current_session.state == "created" do
              RcSessions.transition_to_starting(session_id)
            end

            # Update activity timestamp
            RcSessions.update_activity(session_id)

            socket =
              socket
              |> assign(:session_id, session_id)
              |> assign(:device_id, session.device_id)

            {:ok, socket}
          else
            {:error, %{reason: "Unauthorized or invalid session"}}
          end
      end
    end
  end

  @impl true
  def handle_in("control_event", payload, socket) do
    # Forward control events to device via PubSub
    session_id = socket.assigns.session_id

    Phoenix.PubSub.broadcast(
      Castmill.PubSub,
      "rc_session:#{session_id}",
      %{event: "control_event", payload: payload}
    )

    # Update activity timestamp
    RcSessions.update_activity(session_id)

    {:reply, :ok, socket}
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
  def handle_info(%{event: "media_frame", payload: payload}, socket) do
    # Forward media frames to RC window
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
end
