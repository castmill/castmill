defmodule CastmillWeb.DevicesChannel do
  use CastmillWeb, :channel
  alias Castmill.Devices

  @impl true
  def join("devices:" <> device_id, token, socket) do
    %{:device_id => _device_id, :device_ip => device_ip, :hardware_id => _hardware_id} =
      socket.assigns.device

    if authorized?(device_id, token, device_ip) do
      {:ok, _device} = mark_online(socket)
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def handle_in("heartbeat", _payload, socket) do
    mark_online(socket)
    {:noreply, socket}
  end

  # Not sure we should use the socket connection for getting stufff, seems conterintuitive
  @impl true
  def handle_in("req:get:calendars", _payload, socket) do
    %{:device_id => device_id, :device_ip => _device_ip, :hardware_id => _hardware_id} =
      socket.assigns.device

    calendars = Devices.list_calendars(device_id)

    {:reply, {:ok, calendars}, socket}
  end

  # Handle all messages that are not handled by the
  # `handle_in/3` callbacks above
  @impl true
  def handle_in(event, payload, socket) do
    IO.puts("Unhandled event #{inspect(event)} #{inspect(payload)}")
    {:noreply, socket}
  end

  @doc """
    Terminate the socket when the client disconnects.
    When a device disconnects, mark it as offline.
  """
  @impl true
  def terminate(_reason, socket) do
    %{:device_id => device_id, :device_ip => _device_ip, :hardware_id => _hardware_id} =
      socket.assigns.device

    Phoenix.PubSub.broadcast(Castmill.PubSub, "device_updates:#{device_id}", %{online: false})

    case Devices.mark_offline(device_id) do
      {:ok, _} -> :ok
      :error -> :error
    end
  end

  # Add authorization logic here as required.
  defp authorized?(device_id, token, _device_ip) do
    # TODO: It would be possible to provide IP allowlists for devices
    # so only devices with a certain IP address (or address range)
    # can connect to the socket.
    Devices.verify_device_token(device_id, token) != nil
  end

  defp mark_online(socket) do
    ip_address = socket.assigns.device.device_ip
    device_id = socket.assigns.device.device_id
    ip_string = Enum.join(Tuple.to_list(ip_address), ".")

    # Send a message to the devices observer channel to mark the device as online
    Phoenix.PubSub.broadcast(Castmill.PubSub, "device_updates:#{device_id}", %{online: true})

    Devices.mark_online(device_id, ip_string)
  end

end
