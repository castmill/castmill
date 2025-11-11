defmodule CastmillWeb.DeviceSocketTest do
  use CastmillWeb.ChannelCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  describe "connect/3" do
    test "successfully connects and assigns device info" do
      # Create test device
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      device = device_fixture(%{organization_id: organization.id})

      # Simulate connect_info with peer data
      connect_info = %{
        peer_data: %{
          address: {127, 0, 0, 1}
        }
      }

      params = %{
        "device_id" => device.id,
        "hardware_id" => "test_hardware_id"
      }

      # Connect
      assert {:ok, socket} = CastmillWeb.DeviceSocket.connect(params, socket(CastmillWeb.DeviceSocket, "device_socket"), connect_info)
      
      # Verify device info is assigned
      assert socket.assigns.device.device_id == device.id
      assert socket.assigns.device.hardware_id == "test_hardware_id"
      assert socket.assigns.device.device_ip == {127, 0, 0, 1}
    end

    test "connects without device validation at socket level" do
      # Device authentication happens at channel join, not socket connect
      connect_info = %{
        peer_data: %{
          address: {192, 168, 1, 100}
        }
      }

      params = %{
        "device_id" => "any_device_id",
        "hardware_id" => "any_hardware_id"
      }

      # Should connect successfully - validation happens in channel
      assert {:ok, socket} = CastmillWeb.DeviceSocket.connect(params, socket(CastmillWeb.DeviceSocket, "device_socket"), connect_info)
      assert socket.assigns.device.device_id == "any_device_id"
    end
  end
end
