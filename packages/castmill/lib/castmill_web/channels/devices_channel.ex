defmodule CastmillWeb.DevicesChannel do
  use CastmillWeb, :channel
  alias Castmill.Devices

  # Example interval, in milliseconds
  @heartbeat_interval 30_000

  @impl true
  def join("devices:" <> device_id, %{"token" => token}, socket) do
    %{:device_id => _device_id, :device_ip => _device_ip, :hardware_id => _hardware_id} =
      socket.assigns.device

    # TODO: It would be possible to provide IP allowlists for devices
    # so only devices with a certain IP address (or address range)
    # can connect to the socket.
    case Devices.verify_device_token(device_id, token) do
      {:ok, _device} ->
        {:ok, _device} = mark_online(socket)

        Devices.insert_event(%{device_id: device_id, type: "o", msg: "Device connected"})

        # Schedule the heartbeat check
        socket = schedule_heartbeat_check(self(), socket)

        {:ok, socket}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def handle_in("heartbeat", _payload, socket) do
    # Reset the heartbeat timer
    socket = schedule_heartbeat_check(self(), socket)

    {:ok, _device} = mark_online(socket)

    {:noreply, socket}
  end

  @impl true
  def handle_in("res:get", %{"ref" => ref, "page" => page}, socket) do
    # Convert the PID ref string back to a PID
    pid =
      ref
      |> Base.url_decode64!()
      |> :erlang.binary_to_term()

    # Forward the response to the controller that made the request
    send(pid, {:device_response, page})

    {:noreply, socket}
  end

  @impl true
  def handle_in("res:delete", %{"ref" => ref, "result" => result}, socket) do
    IO.puts("Received res:delete with ref: #{inspect(ref)} and result: #{inspect(result)}")
    # Convert the PID ref string back to a PID
    pid =
      ref
      |> Base.url_decode64!()
      |> :erlang.binary_to_term()

    # Forward the response to the controller that made the request
    send(pid, {:device_response, result})

    {:noreply, socket}
  end

  # Not sure we should use the socket connection for getting stufff, seems conterintuitive
  # Going to deprecate this
  @impl true
  def handle_in("req:get:channels", _payload, socket) do
    %{:device_id => device_id, :device_ip => _device_ip, :hardware_id => _hardware_id} =
      socket.assigns.device

    channels = Devices.list_channels(device_id)

    {:reply, {:ok, channels}, socket}
  end

  # Handle all messages that are not handled by the
  # `handle_in/3` callbacks above
  @impl true
  def handle_in(event, payload, socket) do
    IO.puts("Unhandled event: #{inspect(event)}")
    IO.puts("Unhandled payload: #{inspect(payload)}")
    {:noreply, socket}
  end

  # Handle broadcasted messages for a given device via PubSub
  @impl true
  def handle_info(%{get: _resource, payload: payload}, socket) do
    push(socket, "get", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_info(%{delete: _resource, payload: payload}, socket) do
    push(socket, "delete", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_info(%{command: _command} = params, socket) do
    push(socket, "command", params)
    {:noreply, socket}
  end

  @impl true
  def handle_info(:check_heartbeat, socket) do
    device_id = socket.assigns.device.device_id

    # Mark the device as offline if no heartbeat was received
    Devices.mark_offline(device_id)

    Devices.insert_event(%{
      device_id: device_id,
      type: "x",
      msg: "Device went offline due to inactivity"
    })

    Phoenix.PubSub.broadcast(Castmill.PubSub, "device_updates:#{device_id}", %{online: false})

    {:noreply, socket}
  end

  @doc """
    Terminate the socket when the client disconnects.
    When a device disconnects, mark it as offline.
  """
  @impl true
  def terminate(reason, socket) do
    IO.inspect("Terminating socket with reason: #{inspect(reason)}")

    %{:device_id => device_id, :device_ip => _device_ip, :hardware_id => _hardware_id} =
      socket.assigns.device

    Phoenix.PubSub.broadcast(Castmill.PubSub, "device_updates:#{device_id}", %{online: false})

    case Devices.mark_offline(device_id) do
      {:ok, _device} ->
        Devices.insert_event(%{device_id: device_id, type: "x", msg: "Device disconnected"})

      # No reason to communicate this error further as there is not a lot we can do
      _ ->
        :ok
    end
  end

  defp schedule_heartbeat_check(channel_pid, socket) do
    # Cancel the existing timer and schedule a new one
    timer_ref = socket.assigns[:timer_ref]
    if timer_ref, do: Process.cancel_timer(timer_ref)

    # Schedule a message to check the heartbeat after the interval
    new_timer_ref =
      Process.send_after(channel_pid, :check_heartbeat, @heartbeat_interval * 2)

    assign(socket, :timer_ref, new_timer_ref)
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
