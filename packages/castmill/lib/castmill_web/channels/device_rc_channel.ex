defmodule CastmillWeb.DeviceRcChannel do
  @moduledoc """
  WebSocket channel for device remote control communication.

  This channel handles the device side of remote control sessions.
  The device can connect in two modes:
  1. Standby mode (no session_id) - Just sends heartbeats to indicate RC app is available
     Only requires hardware_id for identification (same ID used by player app)
  2. Session mode (with session_id) - Active RC session with full control
     Requires token authentication for security

  Topics: "device_rc:<device_id>"
  """
  use CastmillWeb, :channel

  alias Castmill.Devices
  alias Castmill.Devices.RcSessions
  alias Castmill.Devices.RcRelay
  alias Castmill.Devices.RcLogger
  alias Castmill.Devices.RcTelemetry

  require Logger

  @impl true
  # Standby mode - RC app is running but no active session
  # Only requires hardware_id - verifies device exists in database
  def join("device_rc:" <> device_id, %{"hardware_id" => hardware_id}, socket) do
    Logger.info("RC channel join attempt: topic=device_rc:#{device_id}, hardware_id=#{hardware_id}")

    try do
      # Verify this hardware_id matches a registered device
      case Devices.get_device_by_hardware_id(hardware_id) do
        nil ->
          Logger.warning("RC channel join failed: Device not registered with hardware_id=#{hardware_id}")
          {:error, %{reason: "Device not registered"}}

        device ->
          Logger.info("RC channel join success: device.id=#{device.id}, hardware_id=#{hardware_id}")

          socket = socket
            |> assign(:device_id, device.id)
            |> assign(:hardware_id, hardware_id)
            |> assign(:device, device)
            |> assign(:standby_mode, true)

          # Update RC heartbeat to indicate app is available
          Logger.info("Updating RC heartbeat for device.id=#{device.id}")
          result = Devices.update_rc_heartbeat(device.id)
          Logger.info("RC heartbeat update result: #{inspect(result)}")

          {:ok, socket}
      end
    rescue
      e ->
        Logger.error("RC channel join crashed: #{inspect(e)}")
        {:error, %{reason: "Internal error"}}
    end
  end

  @impl true
  def join("device_rc:" <> device_id, %{"token" => token, "session_id" => session_id}, socket) do
    # Verify the device token
    case Devices.verify_device_token(device_id, token) do
      {:ok, device} ->
        # Verify the session exists and is active
        case RcSessions.get_session(session_id) do
          nil ->
            {:error, %{reason: "Session not found"}}

          session ->
            if session.device_id == device.id and session.state in ["created", "starting", "streaming"] do
              socket = socket
                |> assign(:device_id, device_id)
                |> assign(:device, device)
                |> assign(:session_id, session_id)

              # Log device connection
              RcLogger.info("Device connected to RC channel", session_id, device_id)

              # Transition session to starting if it's still in created state
              # Re-fetch to avoid race conditions
              current_session = RcSessions.get_session(session_id)
              if current_session && current_session.state == "created" do
                RcSessions.transition_to_starting(session_id)
              end

              # Update activity timestamp
              RcSessions.update_activity(session_id)

              # Notify RC window that device is connected
              Phoenix.PubSub.broadcast(
                Castmill.PubSub,
                "rc_session:#{session_id}",
                %{event: "device_connected", device_id: device_id}
              )

              {:ok, socket}
            else
              {:error, %{reason: "Invalid session"}}
            end
        end

      {:error, reason} ->
        {:error, %{reason: reason}}
    end
  end

  @impl true
  def handle_in("phx_heartbeat", _payload, socket) do
    # Handle Phoenix protocol heartbeat - just reply ok to keep connection alive
    {:reply, :ok, socket}
  end

  @impl true
  def handle_in("rc_heartbeat", _payload, socket) do
    # Update the RC heartbeat timestamp to indicate the RC app is still running
    device_id = socket.assigns.device_id
    Devices.update_rc_heartbeat(device_id)
    {:reply, :ok, socket}
  end

  @impl true
  def handle_in("stats_report", _payload, socket) do
    # Handle diagnostics/stats reports from the Android app
    # For now, just acknowledge receipt - could be used for monitoring later
    {:reply, :ok, socket}
  end

  @impl true
  def handle_in("control_event", payload, socket) do
    # Forward control events from RC window to device
    # These events come through PubSub from the RC window channel
    broadcast_from(socket, "control_event", payload)

    # Update activity timestamp
    if socket.assigns[:session_id] do
      RcSessions.update_activity(socket.assigns.session_id)
    end

    {:reply, :ok, socket}
  end

  @impl true
  def handle_in("device_event", payload, socket) do
    # Forward device events to RC window via PubSub
    session_id = socket.assigns[:session_id]

    if session_id do
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "rc_session:#{session_id}",
        %{event: "device_event", payload: payload}
      )

      # Update activity timestamp
      RcSessions.update_activity(session_id)
    end

    {:reply, :ok, socket}
  end

  @impl true
  def handle_info(%{event: "control_event", payload: payload, source: :relay}, socket) do
    # Received from relay (via PubSub), push to device WebSocket
    push(socket, "control_event", payload)

    # Update activity timestamp
    if socket.assigns[:session_id] do
      RcSessions.update_activity(socket.assigns.session_id)
    end

    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: "control_event", payload: payload}, socket) do
    # Legacy direct PubSub (backward compatibility)
    # Received from PubSub, push to device WebSocket
    push(socket, "control_event", payload)

    # Update activity timestamp
    if socket.assigns[:session_id] do
      RcSessions.update_activity(socket.assigns.session_id)
    end

    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: "stop_session"}, socket) do
    # Session stopped, disconnect device
    push(socket, "session_stopped", %{})
    {:stop, :normal, socket}
  end

  @impl true
  def handle_info(%{event: "session_closed"}, socket) do
    # Session closed (timeout or explicit close), disconnect device
    push(socket, "session_closed", %{})
    {:stop, :normal, socket}
  end

  @impl true
  def terminate(_reason, socket) do
    # Notify RC window that device disconnected
    session_id = socket.assigns[:session_id]
    device_id = socket.assigns[:device_id]

    if session_id do
      # Log device disconnection
      RcLogger.info("Device disconnected from RC channel", session_id, device_id)

      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "rc_session:#{session_id}",
        %{event: "device_disconnected", device_id: device_id}
      )
    end

    :ok
  end
end
