defmodule CastmillWeb.DevicesChannel do
  use CastmillWeb, :channel
  alias Castmill.Devices

  @impl true
  def join("devices:" <> device_id, token, socket) do
    %{:device_id => _device_id, :device_ip => device_ip, :hardware_id => _hardware_id} =
      socket.assigns.device

    if authorized?(device_id, token, device_ip) do
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  # Channels can be used in a request/response fashion
  # by sending replies to requests from the client
  @impl true
  def handle_in("ping", payload, socket) do
    {:reply, {:ok, payload}, socket}
  end

  @impl true
  def handle_in("req:get:calendars", payload, socket) do
    %{:device_id => device_id, :device_ip => device_ip, :hardware_id => _hardware_id} =
      socket.assigns.device

    calendars = Devices.list_calendars(device_id)

    {:reply, {:ok, calendars}, socket}
  end

  # Handle all messages that are not handled by the
  # `handle_in/3` callbacks above
  @impl true
  def handle_in(_event, _payload, socket) do
    {:noreply, socket}
  end

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (resources:lobby).
  @impl true
  def handle_in("shout", payload, socket) do
    broadcast(socket, "shout", payload)
    {:noreply, socket}
  end

  # Add authorization logic here as required.
  defp authorized?(device_id, token, _device_ip) do
    # TODO: It would be possible to provide IP allowlists for devices
    # so only devices with a certain IP address (or address range)
    # can connect to the socket.
    Devices.verify_device_token(device_id, token) != nil
  end
end
