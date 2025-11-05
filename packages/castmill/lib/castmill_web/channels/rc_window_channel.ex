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
  alias Castmill.Accounts

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
          if session.user_id == user_id and session.status == "active" do
            # Subscribe to session PubSub topic to receive device events
            Phoenix.PubSub.subscribe(Castmill.PubSub, "rc_session:#{session_id}")

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

    {:noreply, socket}
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

    {:noreply, socket}
  end

  # Handle messages from PubSub (from device channels)
  @impl true
  def handle_info(%{event: "device_connected", device_id: device_id}, socket) do
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
  def terminate(_reason, socket) do
    # Unsubscribe from PubSub when disconnecting
    session_id = socket.assigns[:session_id]

    if session_id do
      Phoenix.PubSub.unsubscribe(Castmill.PubSub, "rc_session:#{session_id}")
    end

    :ok
  end
end
