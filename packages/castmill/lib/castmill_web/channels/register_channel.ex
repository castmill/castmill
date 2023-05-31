defmodule CastmillWeb.RegisterChannel do
  use CastmillWeb, :channel
  alias Castmill.Devices

  @impl true
  def join("register:" <> hardware_id, %{"pincode" => pincode}, socket) do
    if authorized?(hardware_id, pincode) do
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

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (register:lobby).
  @impl true
  def handle_in("shout", payload, socket) do
    broadcast(socket, "shout", payload)
    {:noreply, socket}
  end

  # Add authorization logic here as required.
  defp authorized?(hardware_id, pincode) do
    Devices.get_devices_registration(hardware_id, pincode) != nil
  end
end
