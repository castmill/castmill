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
      Organizations.update_role(organization.id, user.id, :regular)
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

      Organizations.update_role(organization.id, user.id, :regular)

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
end
