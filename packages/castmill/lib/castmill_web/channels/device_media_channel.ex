defmodule CastmillWeb.DeviceMediaChannel do
  @moduledoc """
  WebSocket channel for device media streaming in remote control sessions.

  This channel handles the relay of screen capture/media data from the device
  to the RC window in the dashboard. Media data is forwarded via the relay
  with backpressure management to the RC session subscribers.

  Topics: "device_media:<device_id>:<session_id>"

  Authentication:
  - Can use device token (traditional method)
  - Can use session token (for RC app in standby mode, generated at session start)
  """
  use CastmillWeb, :channel

  alias Castmill.Devices
  alias Castmill.Devices.RcSessions
  alias Castmill.Devices.RcRelay
  alias Castmill.Devices.RcMessageSchemas

  require Logger

  @impl true
  def join(
        "device_media:" <> device_session,
        %{"token" => token},
        socket
      ) do
    # Parse device_id and session_id from topic
    [device_id, session_id] = String.split(device_session, ":", parts: 2)

    # Try session token first (for RC app in standby mode), then fall back to device token
    case verify_session_token(token, session_id, device_id) do
      {:ok, device} ->
        setup_media_channel(socket, device, session_id)

      {:error, :invalid_session_token} ->
        # Fall back to device token verification
        case Devices.verify_device_token(device_id, token) do
          {:ok, device} ->
            setup_media_channel(socket, device, session_id)

          {:error, reason} ->
            {:error, %{reason: reason}}
        end
    end
  end

  # Verify session token (Phoenix.Token signed at session start)
  defp verify_session_token(token, session_id, device_id) do
    # Max age: 1 day (session should be closed before this)
    max_age = 86400

    case Phoenix.Token.verify(CastmillWeb.Endpoint, "rc_session", token, max_age: max_age) do
      {:ok, %{session_id: ^session_id, device_id: ^device_id}} ->
        # Token is valid and matches session/device
        case Devices.get_device(device_id) do
          nil -> {:error, :invalid_session_token}
          device -> {:ok, device}
        end

      {:ok, _claims} ->
        # Token is valid but session_id or device_id doesn't match
        Logger.warning("Session token mismatch: token claims don't match session/device")
        {:error, :invalid_session_token}

      {:error, _reason} ->
        {:error, :invalid_session_token}
    end
  end

  defp setup_media_channel(socket, device, session_id) do
    # Verify the session exists and is active
    case RcSessions.get_session(session_id) do
      nil ->
        {:error, %{reason: "Session not found"}}

      session ->
        if session.device_id == device.id and session.status == "active" do
          socket =
            socket
            |> assign(:device_id, device.id)
            |> assign(:device, device)
            |> assign(:session_id, session_id)

          Logger.info("Media channel joined: device_id=#{device.id}, session_id=#{session_id}")

          # Notify RC window that media stream is ready
          Phoenix.PubSub.broadcast(
            Castmill.PubSub,
            "rc_session:#{session_id}",
            %{event: "media_stream_ready", device_id: device.id}
          )

          {:ok, socket}
        else
          {:error, %{reason: "Invalid session"}}
        end
    end
  end

  @impl true
  def handle_in("phx_heartbeat", _payload, socket) do
    # Respond to Phoenix heartbeats to keep the connection alive
    {:reply, :ok, socket}
  end

  @impl true
  def handle_in("media_frame", %{"data" => _data} = payload, socket) do
    # Forward media frames to RC window via relay with backpressure
    session_id = socket.assigns.session_id

    Logger.debug("DeviceMediaChannel received media_frame for session #{session_id}, frame_type: #{Map.get(payload, "frame_type", "unknown")}")

    case RcRelay.enqueue_media_frame(session_id, payload) do
      :ok ->
        Logger.debug("DeviceMediaChannel: frame enqueued successfully")
        {:reply, :ok, socket}

      {:ok, :dropped} ->
        # P-frame was dropped due to backpressure, still acknowledge
        {:reply, :ok, socket}

      {:error, :invalid_message} ->
        {:reply, {:error, %{reason: "Invalid media frame message"}}, socket}

      {:error, :session_not_found} ->
        {:reply, {:error, %{reason: "Session not found"}}, socket}

      {:error, reason} when is_atom(reason) ->
        {:reply, {:error, %{reason: Atom.to_string(reason)}}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  @impl true
  def handle_in("media_metadata", payload, socket) do
    # Forward media metadata (resolution, fps, etc.) to RC window with validation
    session_id = socket.assigns.session_id

    case RcMessageSchemas.validate_media_metadata(payload) do
      {:ok, validated_payload} ->
        Phoenix.PubSub.broadcast(
          Castmill.PubSub,
          "rc_session:#{session_id}",
          %{event: "media_metadata", payload: validated_payload}
        )

        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  @impl true
  def handle_info(%{event: "stop_session"}, socket) do
    # Session stopped, disconnect media stream
    push(socket, "session_stopped", %{})
    {:stop, :normal, socket}
  end

  @impl true
  def terminate(_reason, socket) do
    # Notify RC window that media stream disconnected
    session_id = socket.assigns[:session_id]

    if session_id do
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "rc_session:#{session_id}",
        %{event: "media_stream_disconnected", device_id: socket.assigns.device_id}
      )
    end

    :ok
  end
end
