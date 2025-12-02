defmodule CastmillWeb.DeviceMediaChannel do
  @moduledoc """
  WebSocket channel for device media streaming in remote control sessions.

  This channel handles the relay of screen capture/media data from the device
  to the RC window in the dashboard. Media data is forwarded via the relay
  with backpressure management to the RC session subscribers.

  Topics: "device_media:<device_id>:<session_id>"
  """
  use CastmillWeb, :channel

  alias Castmill.Devices
  alias Castmill.Devices.RcSessions
  alias Castmill.Devices.RcRelay
  alias Castmill.Devices.RcMessageSchemas

  @impl true
  def join(
        "device_media:" <> device_session,
        %{"token" => token},
        socket
      ) do
    # Parse device_id and session_id from topic
    [device_id, session_id] = String.split(device_session, ":", parts: 2)

    # Verify the device token
    case Devices.verify_device_token(device_id, token) do
      {:ok, device} ->
        # Verify the session exists and is active
        case RcSessions.get_session(session_id) do
          nil ->
            {:error, %{reason: "Session not found"}}

          session ->
            if session.device_id == device.id and session.status == "active" do
              socket =
                socket
                |> assign(:device_id, device_id)
                |> assign(:device, device)
                |> assign(:session_id, session_id)

              # Notify RC window that media stream is ready
              Phoenix.PubSub.broadcast(
                Castmill.PubSub,
                "rc_session:#{session_id}",
                %{event: "media_stream_ready", device_id: device_id}
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
  def handle_in("media_frame", %{"data" => _data} = payload, socket) do
    # Forward media frames to RC window via relay with backpressure
    session_id = socket.assigns.session_id

    case RcRelay.enqueue_media_frame(session_id, payload) do
      :ok ->
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
