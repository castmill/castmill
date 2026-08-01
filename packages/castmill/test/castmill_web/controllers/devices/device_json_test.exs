defmodule CastmillWeb.DeviceJSONTest do
  use Castmill.DataCase

  alias Castmill.Devices
  alias CastmillWeb.DeviceJSON

  import Castmill.DevicesFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  describe "recover/1" do
    test "renders flat organization_name and network_name fields" do
      network = network_fixture(%{name: "Recovery Network"})

      organization =
        organization_fixture(%{network_id: network.id, name: "Recovery Organization"})

      {:ok, devices_registration} =
        device_registration_fixture(%{hardware_id: "recover-json-hw", pincode: "recover01"})

      {:ok, {device, _token}} =
        Devices.register_device(organization.id, devices_registration.pincode, %{
          name: "Recover Device"
        })

      full_device = Devices.get_device(device.id)
      response = DeviceJSON.recover(%{device: full_device})

      assert response.data.organization_name == organization.name
      assert response.data.network_name == network.name
      refute Map.has_key?(response.data, :organization)
      refute Map.has_key?(response.data, :network)
    end
  end
end
