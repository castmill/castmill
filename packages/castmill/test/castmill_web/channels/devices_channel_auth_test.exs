defmodule CastmillWeb.DevicesChannelAuthTest do
  use CastmillWeb.ChannelCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  describe "join devices:device_id with device token authentication" do
    setup do
      # Create test data
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      device = device_fixture(%{organization_id: organization.id})

      {:ok, device: device}
    end

    test "successfully joins with valid device token", %{device: device} do
      {:ok, _, socket} =
        CastmillWeb.DeviceSocket
        |> socket("device_id", %{
          device: %{
            device_id: device.id,
            hardware_id: "test_hardware",
            device_ip: {127, 0, 0, 1}
          }
        })
        |> subscribe_and_join(
          CastmillWeb.DevicesChannel,
          "devices:#{device.id}",
          %{"token" => device.token}
        )

      assert socket.assigns.device.device_id == device.id
    end

    test "rejects join with invalid device token", %{device: device} do
      assert {:error, _reason} =
               CastmillWeb.DeviceSocket
               |> socket("device_id", %{
                 device: %{
                   device_id: device.id,
                   hardware_id: "test_hardware",
                   device_ip: {127, 0, 0, 1}
                 }
               })
               |> subscribe_and_join(
                 CastmillWeb.DevicesChannel,
                 "devices:#{device.id}",
                 %{"token" => "invalid_token"}
               )
    end

    test "rejects join with mismatched device_id", %{device: device} do
      fake_device_id = Ecto.UUID.generate()

      assert {:error, _reason} =
               CastmillWeb.DeviceSocket
               |> socket("device_id", %{
                 device: %{
                   device_id: fake_device_id,
                   hardware_id: "test_hardware",
                   device_ip: {127, 0, 0, 1}
                 }
               })
               |> subscribe_and_join(
                 CastmillWeb.DevicesChannel,
                 "devices:#{fake_device_id}",
                 %{"token" => device.token}
               )
    end

    test "rejects join without token", %{device: device} do
      assert {:error, _reason} =
               CastmillWeb.DeviceSocket
               |> socket("device_id", %{
                 device: %{
                   device_id: device.id,
                   hardware_id: "test_hardware",
                   device_ip: {127, 0, 0, 1}
                 }
               })
               |> subscribe_and_join(
                 CastmillWeb.DevicesChannel,
                 "devices:#{device.id}",
                 %{}
               )
    end

    test "rejects join for non-existent device" do
      fake_device_id = Ecto.UUID.generate()

      assert {:error, _reason} =
               CastmillWeb.DeviceSocket
               |> socket("device_id", %{
                 device: %{
                   device_id: fake_device_id,
                   hardware_id: "test_hardware",
                   device_ip: {127, 0, 0, 1}
                 }
               })
               |> subscribe_and_join(
                 CastmillWeb.DevicesChannel,
                 "devices:#{fake_device_id}",
                 %{"token" => "any_token"}
               )
    end
  end

  describe "device token security" do
    test "device tokens use Argon2 hashing" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      device = device_fixture(%{organization_id: organization.id})

      # Verify the device has a hashed token stored
      assert device.token_hash != nil
      assert String.starts_with?(device.token_hash, "$argon2")

      # Verify token validation works
      assert {:ok, _device} = Castmill.Devices.verify_device_token(device.id, device.token)
    end

    test "different devices have different tokens" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      device1 = device_fixture(%{organization_id: organization.id})
      device2 = device_fixture(%{organization_id: organization.id})

      # Tokens should be different
      assert device1.token != device2.token
      assert device1.token_hash != device2.token_hash

      # Each token should only work for its own device
      assert {:ok, _} = Castmill.Devices.verify_device_token(device1.id, device1.token)
      assert {:error, _} = Castmill.Devices.verify_device_token(device1.id, device2.token)
    end
  end
end
