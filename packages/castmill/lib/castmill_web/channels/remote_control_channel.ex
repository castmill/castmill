defmodule CastmillWeb.RemoteControlChannel do
  @moduledoc """
  WebSocket channel for remote control clients.
  
  This channel handles:
  - Session initialization from RC clients
  - Relaying media frames from devices to RC clients
  - Forwarding control commands from RC clients to devices
  """

  use CastmillWeb, :channel
  alias Castmill.Relay.SessionManager
  alias Castmill.Devices
  alias Castmill.Organizations
  alias CastmillWeb.Schemas.RelayMessageSchemas

  require Logger

  @impl true
  def join("remote_control:" <> device_id, %{"session_id" => session_id}, socket) do
    %{:user => user} = socket.assigns

    Logger.info(
      "User #{user.id} joining remote control channel for device #{device_id} with session #{session_id}"
    )

    # Verify user has access to the device
    if authorized?(user.id, device_id) do
      # Create or join the session
      case SessionManager.create_session(session_id, device_id, self()) do
        {:ok, _session} ->
          socket =
            socket
            |> assign(:session_id, session_id)
            |> assign(:device_id, device_id)

          # Broadcast to device to start streaming
          Phoenix.PubSub.broadcast(
            Castmill.PubSub,
            "device_control:#{device_id}",
            %{
              type: "start_session",
              session_id: session_id,
              device_id: device_id
            }
          )

          {:ok, %{status: "session_created"}, socket}

        {:error, :session_exists} ->
          # Session already exists, add this channel as another viewer
          case SessionManager.add_rc_channel(session_id, self()) do
            :ok ->
              socket =
                socket
                |> assign(:session_id, session_id)
                |> assign(:device_id, device_id)

              {:ok, %{status: "session_joined"}, socket}

            {:error, reason} ->
              {:error, %{reason: "Failed to join session: #{reason}"}}
          end

        {:error, reason} ->
          {:error, %{reason: "Failed to create session: #{reason}"}}
      end
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def join("remote_control:" <> _device_id, _params, _socket) do
    {:error, %{reason: "Missing session_id parameter"}}
  end

  @impl true
  def handle_in("control_command", payload, socket) do
    case RelayMessageSchemas.validate_message(Map.put(payload, "type", "control_command")) do
      {:ok, validated} ->
        # Forward command to device via PubSub
        Phoenix.PubSub.broadcast(
          Castmill.PubSub,
          "device_control:#{socket.assigns.device_id}",
          validated
        )

        {:reply, {:ok, %{status: "command_sent"}}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  @impl true
  def handle_in("stop_session", payload, socket) do
    session_id = socket.assigns.session_id

    case RelayMessageSchemas.validate_message(
           Map.merge(payload, %{"type" => "stop_session", "session_id" => session_id})
         ) do
      {:ok, _validated} ->
        SessionManager.stop_session(session_id)

        # Notify device to stop streaming
        Phoenix.PubSub.broadcast(
          Castmill.PubSub,
          "device_control:#{socket.assigns.device_id}",
          %{
            type: "stop_session",
            session_id: session_id
          }
        )

        {:reply, {:ok, %{status: "session_stopped"}}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  @impl true
  def handle_in(event, payload, socket) do
    Logger.warning("Unhandled event #{inspect(event)} #{inspect(payload)}")
    {:noreply, socket}
  end

  # Receive media frames from session manager and push to client
  @impl true
  def handle_info({:relay_frame, frame}, socket) do
    push(socket, "media_frame", frame)
    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, socket) do
    session_id = socket.assigns[:session_id]

    if session_id do
      Logger.info("RC channel terminating for session #{session_id}")
      SessionManager.remove_rc_channel(session_id, self())
    end

    :ok
  end

  # Verify if the user is authorized to access this device
  defp authorized?(actor_id, device_id) do
    device = Devices.get_device(device_id)

    case device do
      nil ->
        false

      _ ->
        Organizations.has_access(device.organization_id, actor_id, "devices", "read")
    end
  end
end
