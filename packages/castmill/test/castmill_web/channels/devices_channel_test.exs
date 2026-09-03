defmodule CastmillWeb.DevicesChannelTest do
  use CastmillWeb.ChannelCase, async: true

  alias CastmillWeb.DevicesChannel

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  setup do
    # Create network, organization, and device
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})

    # Register a device
    {:ok, devices_registration} = device_registration_fixture()

    {:ok, {device, token}} =
      Castmill.Devices.register_device(organization.id, devices_registration.pincode, %{
        name: "Test Device"
      })

    # Create socket with device assigns - device_ip must be a tuple
    socket =
      CastmillWeb.DeviceSocket
      |> socket("device_id", %{
        device: %{device_id: device.id, hardware_id: "test", device_ip: {127, 0, 0, 1}}
      })

    %{socket: socket, device: device, token: token, organization: organization}
  end

  describe "handle_info/2 - channel_updated" do
    test "pushes channel_updated event to client", %{socket: socket, device: device, token: token} do
      # Join the channel first
      {:ok, _reply, socket} =
        subscribe_and_join(socket, DevicesChannel, "devices:#{device.id}", %{"token" => token})

      # Send the channel_updated message
      message = %{
        event: "channel_updated",
        channel_id: 123,
        default_playlist_id: 456
      }

      DevicesChannel.handle_info(message, socket)

      # Verify the message is pushed to the client
      assert_push "channel_updated", %{
        event: "channel_updated",
        channel_id: 123,
        default_playlist_id: 456
      }
    end

    test "pushes channel_updated event with nil default_playlist_id", %{
      socket: socket,
      device: device,
      token: token
    } do
      # Join the channel first
      {:ok, _reply, socket} =
        subscribe_and_join(socket, DevicesChannel, "devices:#{device.id}", %{"token" => token})

      # Send the channel_updated message with nil default_playlist_id
      message = %{
        event: "channel_updated",
        channel_id: 123,
        default_playlist_id: nil
      }

      DevicesChannel.handle_info(message, socket)

      # Verify the message is pushed to the client
      assert_push "channel_updated", %{
        event: "channel_updated",
        channel_id: 123,
        default_playlist_id: nil
      }
    end
  end

  describe "handle_info/2 - channel_added" do
    test "pushes channel_added event to client", %{socket: socket, device: device, token: token} do
      # Join the channel first
      {:ok, _reply, socket} =
        subscribe_and_join(socket, DevicesChannel, "devices:#{device.id}", %{"token" => token})

      # Send the channel_added message
      message = %{
        event: "channel_added",
        channel: %{
          id: 123,
          name: "Test Channel",
          timezone: "Europe/Amsterdam",
          default_playlist_id: 456,
          entries: []
        }
      }

      DevicesChannel.handle_info(message, socket)

      # Verify the message is pushed to the client
      assert_push "channel_added", %{
        event: "channel_added",
        channel: %{
          id: 123,
          name: "Test Channel",
          timezone: "Europe/Amsterdam",
          default_playlist_id: 456,
          entries: []
        }
      }
    end
  end

  describe "handle_info/2 - channel_removed" do
    test "pushes channel_removed event to client", %{socket: socket, device: device, token: token} do
      # Join the channel first
      {:ok, _reply, socket} =
        subscribe_and_join(socket, DevicesChannel, "devices:#{device.id}", %{"token" => token})

      # Send the channel_removed message
      message = %{
        event: "channel_removed",
        channel_id: 123
      }

      DevicesChannel.handle_info(message, socket)

      # Verify the message is pushed to the client
      assert_push "channel_removed", %{
        event: "channel_removed",
        channel_id: 123
      }
    end
  end

  describe "handle_info/2 - device update (enabled)" do
    test "pushes update event to client when device is disabled", %{
      socket: socket,
      device: device,
      token: token
    } do
      {:ok, _reply, socket} =
        subscribe_and_join(socket, DevicesChannel, "devices:#{device.id}", %{"token" => token})

      message = %{
        update: "device",
        resource: "device",
        action: "update",
        data: %{enabled: false}
      }

      DevicesChannel.handle_info(message, socket)

      assert_push "update", %{
        resource: "device",
        action: "update",
        data: %{enabled: false}
      }
    end

    test "pushes update event to client when device is enabled", %{
      socket: socket,
      device: device,
      token: token
    } do
      {:ok, _reply, socket} =
        subscribe_and_join(socket, DevicesChannel, "devices:#{device.id}", %{"token" => token})

      message = %{
        update: "device",
        resource: "device",
        action: "update",
        data: %{enabled: true}
      }

      DevicesChannel.handle_info(message, socket)

      assert_push "update", %{
        resource: "device",
        action: "update",
        data: %{enabled: true}
      }
    end
  end

  describe "join/3" do
    test "returns the persisted enabled state in the join reply", %{
      socket: socket,
      device: device,
      token: token
    } do
      assert {:ok, device} = Castmill.Devices.update_device(device, %{enabled: false})

      {:ok, reply, _socket} =
        subscribe_and_join(socket, DevicesChannel, "devices:#{device.id}", %{"token" => token})

      assert reply == %{enabled: false}
    end
  end
end
