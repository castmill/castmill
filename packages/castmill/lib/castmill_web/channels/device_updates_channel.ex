defmodule CastmillWeb.DeviceUpdatesChannel do
  use CastmillWeb, :channel
  alias Castmill.Devices
  alias Castmill.Organizations

  require Logger

  @impl true
  def join("device_updates:" <> device_id, _params, socket) do
    %{:user => user} = socket.assigns

    Logger.info("User #{user.id} is joining device_updates channel for device #{device_id}")

    if authorized?(user.id, device_id) do
      send(self(), :sync_orientation)
      {:ok, assign(socket, :device_id, device_id)}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  # Handle all messages that are not handled by the
  # `handle_in/3` callbacks above
  @impl true
  def handle_in(event, payload, socket) do
    IO.puts("Unhandled event #{inspect(event)} #{inspect(payload)}")
    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, _socket) do
    Logger.info("DeviceUpdatesChannel terminated")
    :ok
  end

  # Handle broadcasted messages from the device channel via PubSub
  @impl true
  def handle_info(:sync_orientation, socket) do
    {:noreply, sync_orientation(socket)}
  end

  def handle_info(%{online: true}, socket) do
    push(socket, "device:status", %{device_id: socket.assigns.device_id, online: true})
    {:noreply, sync_orientation(assign(socket, :online, true))}
  end

  def handle_info(%{online: false}, socket) do
    push(socket, "device:status", %{device_id: socket.assigns.device_id, online: false})
    {:noreply, assign(socket, online: false, orientation_status: nil)}
  end

  # We need to verify if the user is authorized to access this device.
  def handle_info(%{orientation: orientation}, socket) do
    push(socket, "device:status", %{
      device_id: socket.assigns.device_id,
      orientation: orientation
    })

    {:noreply, assign(socket, :orientation_status, nil)}
  end

  def handle_info(%{orientation_status: report}, socket) do
    push(socket, "device:status", %{
      device_id: socket.assigns.device_id,
      orientation_status: report
    })

    {:noreply, assign(socket, :orientation_status, report)}
  end

  def handle_info(%{info: info}, socket) do
    push(socket, "device:status", %{device_id: socket.assigns.device_id, info: info})
    {:noreply, sync_orientation(socket)}
  end

  defp sync_orientation(socket) do
    device = Devices.get_device(socket.assigns.device_id)
    report = socket.assigns[:orientation_status]

    if device &&
         Map.get(socket.assigns, :online, device.online) &&
         get_in(device.info || %{}, ["capabilities", "orientation"]) == true &&
         !(report && report.orientation == device.orientation) do
      # Reuse the normal apply/report path; an already-applied value is not rotated again.
      Phoenix.PubSub.broadcast(Castmill.PubSub, "devices:#{device.id}", %{
        event: "orientation_updated",
        orientation: device.orientation
      })
    end

    socket
  end

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
