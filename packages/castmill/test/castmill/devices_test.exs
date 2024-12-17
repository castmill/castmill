defmodule Castmill.DevicesTest do
  use Castmill.DataCase

  @moduletag :devices_data_case

  alias Castmill.Resources

  describe "devices" do
    @describetag :devices

    alias Castmill.Devices

    import Castmill.NetworksFixtures
    import Castmill.OrganizationsFixtures
    import Castmill.DevicesFixtures
    import Castmill.ChannelsFixtures
    import Castmill.PlaylistsFixtures

    test "register_device/1 registers a device" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      assert Devices.list_devices(%{organization_id: organization.id}) == []

      {:ok, devices_registration} = device_registration_fixture()

      assert {:ok, {device, _token}} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })

      assert Devices.list_devices(%{organization_id: organization.id}) == [device]
    end

    test "register_device/1 cannot register the same device twice" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      assert Devices.list_devices(%{organization_id: organization.id}) == []

      {:ok, devices_registration} = device_registration_fixture()

      assert {:ok, {device, _token}} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })

      assert Devices.list_devices(%{organization_id: organization.id}) == [device]

      assert {:error, :invalid_pincode} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })
    end

    test "register_device/1 cannot register two devices with the same hardware_id" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      assert Devices.list_devices(%{organization_id: organization.id}) == []

      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})

      assert {:ok, {device, _token}} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })

      assert Devices.list_devices(%{organization_id: organization.id}) == [device]

      {:ok, devices_registration} =
        device_registration_fixture(%{
          hardware_id: "some hardware id",
          pincode: "another pincode"
        })

      assert {:error, _} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "another device"
               })
    end

    test "list_devices/1 returns all devices" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})

      assert {:ok, {device, _token}} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })

      assert Devices.list_devices(%{organization_id: organization.id}) == [device]
    end

    test "update_device/1 updates the device" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})

      assert {:ok, {device, _token}} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })

      assert Devices.list_devices(%{organization_id: organization.id}) == [device]

      update_attrs = %{name: "some updated name"}

      assert {:ok, device} = Devices.update_device(device, update_attrs)
      assert device.name == "some updated name"
    end

    test "delete_device/1 deletes the device" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})

      assert {:ok, {device, _token}} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })

      assert Devices.list_devices(%{organization_id: organization.id}) == [device]

      Devices.delete_device(device)

      assert Devices.list_devices(%{organization_id: organization.id}) == []
    end

    test "verify_device_token/2 verifies if a token is correct for a given device" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})

      assert {:ok, {device, token}} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })

      assert {:ok, _device} = Devices.verify_device_token(device.id, token)
    end

    test "recover_device/2 recovers a device that may have lost its token" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})

      assert {:ok, {device, _token}} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })

      assert {:ok, {_device, _token}} = Devices.recover_device(device.hardware_id, device.last_ip)
    end

    test "recover_device/2 do not recover a device with different ip address" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})

      assert {:ok, {device, _token}} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })

      assert {:error, _} = Devices.recover_device(device.hardware_id, "128.2.3.1")
    end

    test "add_channel/2 adds a channel to a device" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})

      assert {:ok, {device, _token}} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })

      assert Devices.list_channels(device.id) == []

      channel =
        channel_fixture(%{organization_id: organization.id, timezone: "America/Sao_Paulo"})

      Devices.add_channel(device.id, channel.id)

      assert [
               %Castmill.Resources.Channel{
                 id: id,
                 inserted_at: inserted_at,
                 name: name,
                 organization_id: organization_id,
                 timezone: timezone
               }
             ] = Devices.list_channels(device.id)

      assert id == channel.id
      assert inserted_at == channel.inserted_at
      assert name == channel.name
      assert organization_id == channel.organization_id
      assert timezone == channel.timezone
    end

    test "remove_channel/2 removes channel from device" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})

      assert {:ok, {device, _token}} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })

      assert Devices.list_channels(device.id) == []

      channel =
        channel_fixture(%{organization_id: organization.id, timezone: "America/Sao_Paulo"})

      Devices.add_channel(device.id, channel.id)

      assert [
               %Castmill.Resources.Channel{
                 id: id,
                 inserted_at: inserted_at,
                 name: name,
                 organization_id: organization_id,
                 timezone: timezone
               }
             ] = Devices.list_channels(device.id)

      assert id == channel.id
      assert inserted_at == channel.inserted_at
      assert name == channel.name
      assert organization_id == channel.organization_id
      assert timezone == channel.timezone

      Devices.remove_channel(device.id, channel.id)

      assert Devices.list_channels(device.id) == []
    end

    test "has_access_to_channel_entry/2 checks if a device has access to a given channel entry" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})

      assert {:ok, {device, _token}} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })

      assert Devices.list_channels(device.id) == []

      channel =
        channel_fixture(%{organization_id: organization.id, timezone: "America/Sao_Paulo"})

      playlist = playlist_fixture(%{organization_id: organization.id})

      entry_attrs = %{
        name: "some entry name",
        start: DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
        end: DateTime.to_unix(~U[2005-05-05 21:59:03Z]),
        playlist_id: playlist.id
      }

      assert {:ok, entry} = Resources.add_channel_entry(channel.id, entry_attrs)

      assert Devices.has_access_to_channel_entry(device.id, entry.id) == false

      Devices.add_channel(device.id, channel.id)

      assert Devices.has_access_to_channel_entry(device.id, entry.id)

      Devices.remove_channel(device.id, channel.id)

      assert Devices.has_access_to_channel_entry(device.id, entry.id) == false
    end

    test "has_access_to_playlist/2 checks if a device has access to a given playlist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})

      assert {:ok, {device, _token}} =
               Devices.register_device(organization.id, devices_registration.pincode, %{
                 name: "some device"
               })

      assert Devices.list_channels(device.id) == []

      channel =
        channel_fixture(%{organization_id: organization.id, timezone: "America/Sao_Paulo"})

      playlist = playlist_fixture(%{organization_id: organization.id})

      entry_attrs = %{
        name: "some entry name",
        start: DateTime.to_unix(~U[2005-05-05 19:59:03Z]),
        end: DateTime.to_unix(~U[2005-05-05 21:59:03Z]),
        timezone: "Europe/Stockholm",
        playlist_id: playlist.id
      }

      assert {:ok, _entry} = Resources.add_channel_entry(channel.id, entry_attrs)

      assert Devices.has_access_to_playlist(device.id, playlist.id) == false

      Devices.add_channel(device.id, channel.id)

      assert Devices.has_access_to_playlist(device.id, playlist.id)

      Devices.remove_channel(device.id, channel.id)

      assert Devices.has_access_to_playlist(device.id, playlist.id) == false
    end
  end
end
