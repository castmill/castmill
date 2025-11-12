defmodule CastmillWeb.DeviceMediaChannel do
  @moduledoc """
  WebSocket channel for device media streaming.
  
  This channel handles:
  - Device streaming media frames to RC clients
  - Receiving control commands from RC clients
  - Managing session state on the device side
  """

  use CastmillWeb, :channel
  alias Castmill.Relay.SessionManager
  alias Castmill.Devices
  alias CastmillWeb.Schemas.RelayMessageSchemas

  require Logger

  @impl true
  def join("device_media:" <> device_id, %{"token" => token}, socket) do
    %{:device_id => _device_id, :device_ip => _device_ip, :hardware_id => _hardware_id} =
      socket.assigns.device

    # Verify device token
    case Devices.verify_device_token(device_id, token) do
      {:ok, _device} ->
        # Subscribe to device control messages
        Phoenix.PubSub.subscribe(Castmill.PubSub, "device_control:#{device_id}")

        socket = assign(socket, :device_id, device_id)

        Logger.info("Device #{device_id} connected to media channel")

        {:ok, socket}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def handle_in("media_frame", payload, socket) do
    case RelayMessageSchemas.validate_message(Map.put(payload, "type", "media_frame")) do
      {:ok, validated} ->
        session_id = validated.session_id

        # Enqueue frame to session manager for relay
        SessionManager.enqueue_frame(session_id, validated)

        {:noreply, socket}

      {:error, reason} ->
        Logger.error("Invalid media frame: #{reason}")
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  @impl true
  def handle_in("session_status", payload, socket) do
    case RelayMessageSchemas.validate_message(Map.put(payload, "type", "session_status")) do
      {:ok, validated} ->
        # Broadcast status to RC clients via PubSub
        Phoenix.PubSub.broadcast(
          Castmill.PubSub,
          "rc_updates:#{validated.session_id}",
          validated
        )

        {:reply, {:ok, %{status: "status_sent"}}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  @impl true
  def handle_in(event, payload, socket) do
    Logger.warning("Unhandled event #{inspect(event)} #{inspect(payload)}")
    {:noreply, socket}
  end

  # Handle start_session broadcast from RC channel
  @impl true
  def handle_info(%{type: "start_session", session_id: session_id} = message, socket) do
    Logger.info("Device received start_session for session #{session_id}")

    # Register device channel with session manager
    SessionManager.set_device_channel(session_id, self())

    # Notify device to start streaming
    push(socket, "start_session", message)

    {:noreply, socket}
  end

  # Handle stop_session broadcast from RC channel
  @impl true
  def handle_info(%{type: "stop_session", session_id: session_id}, socket) do
    Logger.info("Device received stop_session for session #{session_id}")

    # Notify device to stop streaming
    push(socket, "stop_session", %{session_id: session_id})

    {:noreply, socket}
  end

  # Handle control commands from RC clients
  @impl true
  def handle_info(%{type: "control_command"} = command, socket) do
    Logger.info("Device received control command: #{inspect(command)}")

    # Forward command to device
    push(socket, "control_command", command)

    {:noreply, socket}
  end

  # Handle keyframe request from session manager
  @impl true
  def handle_info({:request_keyframe, session_id}, socket) do
    Logger.info("Device received keyframe request for session #{session_id}")

    # Request device to send a keyframe
    push(socket, "request_keyframe", %{session_id: session_id})

    {:noreply, socket}
  end

  @impl true
  def terminate(reason, socket) do
    Logger.info("Device media channel terminating with reason: #{inspect(reason)}")

    device_id = socket.assigns[:device_id]

    if device_id do
      # Get all sessions for this device and notify them
      sessions = SessionManager.list_device_sessions(device_id)

      Enum.each(sessions, fn session ->
        SessionManager.stop_session(session.session_id)
      end)
    end

    :ok
  end
end
