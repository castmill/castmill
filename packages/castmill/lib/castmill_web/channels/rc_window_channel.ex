defmodule CastmillWeb.RcWindowChannel do
  @moduledoc """
  WebSocket channel for remote control window in the dashboard.

  This channel handles the dashboard side of remote control sessions.
  Dashboard users connect to this channel to control devices and receive
  media streams.

  Requires device_manager role or higher (admin, manager).

  Topics: "rc_window:<session_id>"
  """
  use CastmillWeb, :channel

  alias Castmill.Devices
  alias Castmill.Devices.RcSessions
  alias Castmill.Devices.RcRelay
  alias Castmill.Organizations
  alias Castmill.Devices.RcLogger
  alias Castmill.Devices.RcTelemetry

  require Logger

  @impl true
  def join("rc_window:" <> session_id, _params, socket) do
    Logger.info("RC window join attempt: session_id=#{session_id}")

    # Get user from socket assigns (set by RcSocket authenticate_user)
    user = socket.assigns[:user]
    Logger.info("RC window join: user=#{inspect(user)}")

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
              Logger.info("RC window join: current_session=#{inspect(current_session)}, user.id=#{user.id}")

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

                # Notify the device to start the RC session
                # The device connects to device_rc:<hardware_id>, NOT device_rc:<uuid>
                # So we must broadcast using the hardware_id from the device record
                device_id = current_session.device_id
                hardware_id = device.hardware_id

                # Generate a session token for media WebSocket authentication
                # This allows the RC app (which is in standby mode without device token) to authenticate
                session_token = Phoenix.Token.sign(CastmillWeb.Endpoint, "rc_session", %{
                  session_id: session_id,
                  device_id: device_id
                })

                Logger.info("Sending start_session to device: hardware_id=#{hardware_id}, device_id=#{device_id}, session: #{session_id}")
                CastmillWeb.Endpoint.broadcast(
                  "device_rc:#{hardware_id}",
                  "start_session",
                  %{session_id: session_id, session_token: session_token, device_id: device_id}
                )

                socket =
                  socket
                  |> assign(:session_id, session_id)
                  |> assign(:device_id, device_id)

                {:ok, socket}
              else
                Logger.warning("RC window join failed: current_session=#{inspect(current_session)}, user.id=#{user.id}, session state check failed")
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
  def handle_in("input", payload, socket) do
    # Forward input events (mouse, keyboard) to device via relay
    # Input events are sent directly by the dashboard for real-time control
    session_id = socket.assigns.session_id

    # Transform dashboard input events to Android control event format
    # Dashboard sends: %{"type" => "click", "x" => 100, "y" => 200, "button" => 0}
    # Android expects: %{"event_type" => "tap", "data" => %{"x" => 100, "y" => 200}}
    transformed_payload = transform_input_to_control_event(payload)

    if transformed_payload do
      Logger.debug("RcWindowChannel: Transformed input to control event: #{inspect(transformed_payload)}")
      case RcRelay.enqueue_control_event(session_id, transformed_payload) do
        :ok ->
          Logger.debug("RcWindowChannel: Control event enqueued successfully")
          {:noreply, socket}

        {:error, reason} ->
          Logger.warning("RcWindowChannel: Failed to enqueue control event: #{inspect(reason)}")
          # Don't reply with error for input events - just drop them if queue full
          # This prevents flooding the dashboard with errors for high-frequency events
          {:noreply, socket}
      end
    else
      # Ignore events we don't transform (like mousedown/mouseup - we only act on click)
      {:noreply, socket}
    end
  end

  # Transform dashboard input events to Android control event format
  defp transform_input_to_control_event(%{"type" => "click", "x" => x, "y" => y}) do
    %{
      "event_type" => "tap",
      "data" => %{"x" => x, "y" => y, "duration" => 100}
    }
  end

  defp transform_input_to_control_event(%{"type" => "dblclick", "x" => x, "y" => y}) do
    # Double-click becomes a long press on Android
    %{
      "event_type" => "long_press",
      "data" => %{"x" => x, "y" => y, "duration" => 600}
    }
  end

  # Keyboard events - keydown/keyup for text input
  defp transform_input_to_control_event(%{
         "type" => type,
         "key" => key,
         "code" => code
       } = payload)
       when type in ["keydown", "keyup"] do
    %{
      "event_type" => "key",
      "data" => %{
        "action" => if(type == "keydown", do: "down", else: "up"),
        "key" => key,
        "code" => code,
        "shift" => Map.get(payload, "shift", false),
        "ctrl" => Map.get(payload, "ctrl", false),
        "alt" => Map.get(payload, "alt", false),
        "meta" => Map.get(payload, "meta", false)
      }
    }
  end

  # Ignore mousedown, mouseup, mousemove - we only act on complete gestures
  defp transform_input_to_control_event(%{"type" => type}) when type in ["mousedown", "mouseup", "mousemove"] do
    nil
  end

  defp transform_input_to_control_event(_payload) do
    nil
  end

  @impl true
  def handle_in("control_event", payload, socket) do
    # Forward control events to device via relay with queue management
    session_id = socket.assigns.session_id
    device_id = socket.assigns.device_id

    # Measure latency
    start_time = System.monotonic_time(:microsecond)

    case RcRelay.enqueue_control_event(session_id, payload) do
      :ok ->
        # Calculate latency
        latency_us = System.monotonic_time(:microsecond) - start_time

        # Emit telemetry for control event
        RcTelemetry.control_event_sent(session_id, device_id, latency_us)

        # Update activity timestamp
        RcSessions.update_activity(session_id)
        {:reply, :ok, socket}

      {:error, :queue_full} ->
        # Log and emit telemetry for queue full
        RcLogger.warning("Control queue full", session_id, device_id)
        RcTelemetry.control_queue_full(session_id, device_id)
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

  # Ignore control_events - they are meant for the device channel, not the RC window
  # This happens because both device and RC window subscribe to the same session PubSub topic
  @impl true
  def handle_info(%{event: "control_event", source: :relay}, socket) do
    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: "media_frame", payload: payload, source: :relay}, socket) do
    # Forward media frames from relay to RC window
    session_id = socket.assigns.session_id
    device_id = socket.assigns.device_id

    Logger.debug("RcWindowChannel received media_frame from relay for session #{session_id}")

    # Extract frame metadata for telemetry
    # Use Map.get to safely access payload data (payload is a map with string keys)
    frame_size = byte_size(Map.get(payload, "data", <<>>))

    # Convert string keys to atom keys for telemetry
    frame_metadata = %{}
    frame_metadata = if Map.has_key?(payload, "fps"), do: Map.put(frame_metadata, :fps, payload["fps"]), else: frame_metadata
    frame_metadata = if Map.has_key?(payload, "timestamp"), do: Map.put(frame_metadata, :timestamp, payload["timestamp"]), else: frame_metadata

    # Emit telemetry for media frame
    RcTelemetry.media_frame_received(session_id, device_id, frame_size, frame_metadata)

    Logger.debug("RcWindowChannel pushing media_frame to client")
    push(socket, "media_frame", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: "media_frame", payload: payload}, socket) do
    # Legacy direct PubSub (backward compatibility)
    session_id = socket.assigns.session_id
    device_id = socket.assigns.device_id

    # Extract frame metadata for telemetry
    # Use Map.get to safely access payload data (payload is a map with string keys)
    frame_size = byte_size(Map.get(payload, "data", <<>>))

    # Convert string keys to atom keys for telemetry
    frame_metadata = %{}
    frame_metadata = if Map.has_key?(payload, "fps"), do: Map.put(frame_metadata, :fps, payload["fps"]), else: frame_metadata
    frame_metadata = if Map.has_key?(payload, "timestamp"), do: Map.put(frame_metadata, :timestamp, payload["timestamp"]), else: frame_metadata

    # Emit telemetry for media frame
    RcTelemetry.media_frame_received(session_id, device_id, frame_size, frame_metadata)

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
    device_id = socket.assigns[:device_id]

    if session_id do
      # Log RC window disconnection
      RcLogger.info("RC window disconnected", session_id, device_id)

      Phoenix.PubSub.unsubscribe(Castmill.PubSub, "rc_session:#{session_id}")

      # Stop the session when the RC window closes
      # This ensures the session is properly cleaned up and a new one can be started
      case RcSessions.stop_session(session_id) do
        {:ok, _session} ->
          Logger.info("RC session #{session_id} stopped on window close")
          # Notify device that session has stopped
          Phoenix.PubSub.broadcast(
            Castmill.PubSub,
            "rc_session:#{session_id}",
            %{event: "stop_session"}
          )
        {:error, reason} ->
          Logger.warning("Failed to stop RC session #{session_id} on window close: #{inspect(reason)}")
      end
    end

    :ok
  end

  # Private helper functions

  defp has_rc_permission?(role) do
    # device_manager, manager, and admin roles can use RC features
    role in [:device_manager, :manager, :admin]
  end
end
