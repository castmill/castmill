defmodule Castmill.DevicesTest do
  use Castmill.DataCase

  @moduletag :devices_data_case

  alias Castmill.Resources

  describe "devices" do
    @describetag :devices

    alias Castmill.Devices
    alias Castmill.Devices.Device

    import Castmill.NetworksFixtures
    import Castmill.OrganizationsFixtures
    import Castmill.DevicesFixtures
    import Castmill.CalendarsFixtures

    test "register_device/1 registers a device" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      assert Devices.list_devices(organization.id) == []

      {:ok, devices_registration } = device_registration_fixture()

      assert {:ok, {device, token}} = Devices.register_device(organization.id, devices_registration.pincode, %{ name: "some device"})

      assert Devices.list_devices(organization.id) == [device]
    end

    test "register_device/1 cannot register the same device twice" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      assert Devices.list_devices(organization.id) == []

      {:ok, devices_registration } = device_registration_fixture()

      assert {:ok, {device, token}} = Devices.register_device(organization.id, devices_registration.pincode, %{ name: "some device"})

      assert Devices.list_devices(organization.id) == [device]

      assert {:error, :invalid_pincode} = Devices.register_device(organization.id, devices_registration.pincode, %{ name: "some device"})
    end

    test "register_device/1 cannot register two devices with the same hardware_id" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      assert Devices.list_devices(organization.id) == []

      {:ok, devices_registration } = device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})

      assert {:ok, {device, token}} = Devices.register_device(organization.id, devices_registration.pincode, %{ name: "some device"})

      assert Devices.list_devices(organization.id) == [device]

      {:ok, devices_registration } = device_registration_fixture(%{hardware_id: "some hardware id", pincode: "another pincode"})

      assert {:error, _} = Devices.register_device(organization.id, devices_registration.pincode, %{ name: "another device"})
    end

    test "list_devices/1 returns all devices" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      {:ok, devices_registration } = device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})
      assert {:ok, {device, token}} = Devices.register_device(organization.id, devices_registration.pincode, %{ name: "some device"})

      assert Devices.list_devices(organization.id) == [device]
    end

    test "update_device/1 updates the device" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      {:ok, devices_registration } = device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})
      assert {:ok, {device, token}} = Devices.register_device(organization.id, devices_registration.pincode, %{ name: "some device"})

      assert Devices.list_devices(organization.id) == [device]

      update_attrs = %{name: "some updated name"}

      assert {:ok, device} = Devices.update_device(device, update_attrs)
      assert device.name == "some updated name"
    end

    test "delete_device/1 deletes the device" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      {:ok, devices_registration } = device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})
      assert {:ok, {device, token}} = Devices.register_device(organization.id, devices_registration.pincode, %{ name: "some device"})

      assert Devices.list_devices(organization.id) == [device]

      Devices.delete_device(device)

      assert Devices.list_devices(organization.id) == []
    end

    test "verify_device_token/2 verifies if a token is correct for a given device" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      {:ok, devices_registration } = device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})
      assert {:ok, {device, token}} = Devices.register_device(organization.id, devices_registration.pincode, %{ name: "some device"})

      assert {:ok, device} = Devices.verify_device_token(device.hardware_id, token)
    end

    test "recover_device/2 recovers a device that may have lost its token" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      {:ok, devices_registration } = device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})
      assert {:ok, {device, token}} = Devices.register_device(organization.id, devices_registration.pincode, %{ name: "some device"})

      assert {:ok, {device, token}} = Devices.recover_device(device.hardware_id, device.last_ip)
    end

    test "recover_device/2 do not recover a device with different ip address" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      {:ok, devices_registration } = device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})
      assert {:ok, {device, token}} = Devices.register_device(organization.id, devices_registration.pincode, %{ name: "some device"})

      assert {:error, _} = Devices.recover_device(device.hardware_id, "128.2.3.1")
    end

    test "add_calendar/2 adds a calendar to a device" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      {:ok, devices_registration } = device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})
      assert {:ok, {device, token}} = Devices.register_device(organization.id, devices_registration.pincode, %{ name: "some device"})

      assert Devices.list_calendars(device.id) == []

      calendar = calendar_fixture(%{organization_id: organization.id, timezone: "America/Sao_Paulo"})

      Devices.add_calendar(device.id, calendar.id)

      assert Devices.list_calendars(device.id) == [calendar]
    end

    test "remove_calendar/2 removes calendar from device" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      {:ok, devices_registration } = device_registration_fixture(%{hardware_id: "some hardware id", pincode: "some pincode"})
      assert {:ok, {device, token}} = Devices.register_device(organization.id, devices_registration.pincode, %{ name: "some device"})

      assert Devices.list_calendars(device.id) == []

      calendar = calendar_fixture(%{organization_id: organization.id, timezone: "America/Sao_Paulo"})

      Devices.add_calendar(device.id, calendar.id)

      assert Devices.list_calendars(device.id) == [calendar]

      Devices.remove_calendar(device.id, calendar.id)

      assert Devices.list_calendars(device.id) == []
    end

  end
end
