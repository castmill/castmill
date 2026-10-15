defmodule CastmillWeb.DeviceUpdatesChannelTest do
  use CastmillWeb.ChannelCase, async: true

  alias CastmillWeb.DeviceUpdatesChannel
  alias Castmill.Organizations

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  require Logger

  setup do
    # Create a network, organization, user, and device
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    Organizations.add_user(organization.id, user.id, :admin)

    device = device_fixture(%{organization_id: organization.id})

    {:ok, _, socket} =
      CastmillWeb.UserSocket
      |> socket(user.id, %{user: user})
      |> subscribe_and_join(DeviceUpdatesChannel, "device_updates:" <> device.id, %{})

    %{socket: socket, user: user, device: device, organization: organization}
  end

  describe "join/3" do
    test "forwards desired and applied orientation without changing online status", %{
      socket: socket
    } do
      DeviceUpdatesChannel.handle_info(%{orientation: 90}, socket)
      assert_push "device:status", %{orientation: 90}
      report = %{orientation: 90, status: "applied", mode: "css"}
      DeviceUpdatesChannel.handle_info(%{orientation_status: report}, socket)
      assert_push "device:status", %{orientation_status: ^report}
    end

    test "forwards updated player info and capabilities", %{socket: socket} do
      info = %{"capabilities" => %{"orientation" => true}}
      DeviceUpdatesChannel.handle_info(%{info: info}, socket)
      assert_push "device:status", %{info: ^info}
    end

    test "authorizes user by role and joins the channel", %{
      socket: socket,
      device: device
    } do
      # Join the channel
      {:ok, socket} = DeviceUpdatesChannel.join("device_updates:" <> device.id, %{}, socket)

      assert socket.assigns.device_id == device.id
    end

    test "authorizes user by access and joins the channel", %{
      socket: socket,
      user: user,
      device: device,
      organization: organization
    } do
      Organizations.update_role(organization.id, user.id, :member)
      Organizations.give_access(organization.id, user.id, "devices", "read")

      # Join the channel
      {:ok, socket} = DeviceUpdatesChannel.join("device_updates:" <> device.id, %{}, socket)

      assert socket.assigns.device_id == device.id
    end

    test "returns unauthorized error if the user is not authorized", %{
      socket: socket,
      user: user,
      device: device,
      organization: organization
    } do
      # device_id = "unauthorized_device_id"

      Organizations.update_role(organization.id, user.id, :member)

      # Attempt to join the channel
      assert {:error, %{reason: "unauthorized"}} ==
               DeviceUpdatesChannel.join("device_updates:" <> device.id, %{}, socket)
    end

    test "returns unauthorized error if the device does not exist", %{
      socket: socket
    } do
      device_id = "unauthorized_device_id"

      # Attempt to join the channel
      assert {:error, %{reason: "unauthorized"}} ==
               DeviceUpdatesChannel.join("device_updates:" <> device_id, %{}, socket)
    end
  end

  describe "handle_info/2" do
    test "broadcasts that the device is online", %{socket: socket, device: device} do
      # Send the information to the channel
      DeviceUpdatesChannel.handle_info(%{online: true}, socket)

      # Directly compare device_id without invoking functions within the pattern
      expected_payload = %{device_id: device.id, online: true}

      assert_push("device:status", ^expected_payload)
    end

    test "broadcasts that the device is offline", %{socket: socket, device: device} do
      DeviceUpdatesChannel.handle_info(%{online: false}, socket)

      expected_payload = %{device_id: device.id, online: false}

      assert_push("device:status", ^expected_payload)
    end
  end

  describe "orientation confirmation recovery" do
    setup %{device: device} do
      {:ok, device} =
        Castmill.Devices.update_device(device, %{
          orientation: 90,
          info: %{"capabilities" => %{"orientation" => true}}
        })

      Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")
      %{device: device}
    end

    test "requests a fresh acknowledgement when a dashboard joins an online player", %{
      socket: socket,
      device: device
    } do
      {:ok, _} = Castmill.Devices.mark_online(device.id, "127.0.0.1")
      {:ok, joined} = DeviceUpdatesChannel.join("device_updates:#{device.id}", %{}, socket)

      assert_receive :sync_orientation
      assert {:noreply, _} = DeviceUpdatesChannel.handle_info(:sync_orientation, joined)
      assert_receive %{event: "orientation_updated", orientation: 90}
      refute_push "device:status", %{orientation_status: %{status: "applied"}}
    end

    test "requests the saved offline orientation when the player comes online", %{
      socket: socket,
      device: device
    } do
      {:noreply, socket} = DeviceUpdatesChannel.handle_info(%{online: false}, socket)
      {:ok, _} = Castmill.Devices.update_device(device, %{orientation: 270})

      # The online broadcast can arrive before mark_online finishes its database update.
      assert {:noreply, _} = DeviceUpdatesChannel.handle_info(%{online: true}, socket)
      assert_receive %{event: "orientation_updated", orientation: 270}
      assert_push "device:status", %{online: true}
    end

    test "delivers the reconnect acknowledgement through both live channels", %{device: device} do
      {:ok, _} = Castmill.Devices.update_device(device, %{orientation: 270})

      {:ok, %{orientation: 270}, player_socket} =
        CastmillWeb.DeviceSocket
        |> socket(device.id, %{
          device: %{
            device_id: device.id,
            hardware_id: device.hardware_id,
            device_ip: {127, 0, 0, 1}
          }
        })
        |> subscribe_and_join(CastmillWeb.DevicesChannel, "devices:#{device.id}", %{
          "token" => device.token
        })

      # A request sent during player join can precede its PubSub subscription.
      push(player_socket, "heartbeat", %{})
      assert_push "orientation_updated", %{orientation: 270}

      ref =
        push(player_socket, "orientation:report", %{
          "orientation" => 270,
          "status" => "applied",
          "mode" => "css"
        })

      assert_reply ref, :ok

      assert_push "device:status", %{
        orientation_status: %{orientation: 270, status: "applied", mode: "css"}
      }
    end

    test "retries missed reports, but stops after matching applied or error reports", %{
      socket: socket
    } do
      for status <- ["applied", "error"] do
        {:noreply, socket} = DeviceUpdatesChannel.handle_info(%{online: false}, socket)
        {:noreply, socket} = DeviceUpdatesChannel.handle_info(%{online: true}, socket)
        assert_receive %{event: "orientation_updated", orientation: 90}

        {:noreply, socket} = DeviceUpdatesChannel.handle_info(%{online: true}, socket)
        assert_receive %{event: "orientation_updated", orientation: 90}

        obsolete = %{orientation: 0, status: "applied", mode: "css"}

        {:noreply, socket} =
          DeviceUpdatesChannel.handle_info(%{orientation_status: obsolete}, socket)

        {:noreply, socket} = DeviceUpdatesChannel.handle_info(%{online: true}, socket)
        assert_receive %{event: "orientation_updated", orientation: 90}

        report = %{orientation: 90, status: status, mode: "css"}

        {:noreply, socket} =
          DeviceUpdatesChannel.handle_info(%{orientation_status: report}, socket)

        assert_push "device:status", %{orientation_status: ^report}
        DeviceUpdatesChannel.handle_info(%{online: true}, socket)
        refute_receive %{event: "orientation_updated"}
      end
    end

    test "requests confirmation again after the desired orientation changes", %{
      socket: socket,
      device: device
    } do
      {:noreply, socket} = DeviceUpdatesChannel.handle_info(%{online: true}, socket)
      assert_receive %{event: "orientation_updated", orientation: 90}
      report = %{orientation: 90, status: "applied", mode: "css"}

      {:noreply, socket} =
        DeviceUpdatesChannel.handle_info(%{orientation_status: report}, socket)

      {:ok, _} = Castmill.Devices.update_device(device, %{orientation: 180})
      {:noreply, socket} = DeviceUpdatesChannel.handle_info(%{orientation: 180}, socket)
      DeviceUpdatesChannel.handle_info(%{online: true}, socket)
      assert_receive %{event: "orientation_updated", orientation: 180}
    end

    test "does not request application from offline or unsupported players", %{
      socket: socket,
      device: device
    } do
      DeviceUpdatesChannel.handle_info(:sync_orientation, socket)
      refute_receive %{event: "orientation_updated"}

      {:ok, device} = Castmill.Devices.update_device(device, %{info: %{}})
      {:noreply, socket} = DeviceUpdatesChannel.handle_info(%{online: true}, socket)
      refute_receive %{event: "orientation_updated"}

      info = %{"capabilities" => %{"orientation" => true}}
      {:ok, _} = Castmill.Devices.update_device(device, %{info: info})
      DeviceUpdatesChannel.handle_info(%{info: info}, socket)
      assert_receive %{event: "orientation_updated", orientation: 90}
    end
  end
end
