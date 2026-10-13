defmodule Castmill.DeviceOrientationTest do
  use Castmill.DataCase, async: true

  alias Castmill.Devices.Device
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  test "default and every supported orientation persist" do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    device = device_fixture(%{organization_id: organization.id})
    assert device.orientation == 0

    for angle <- [0, 90, 180, 270] do
      assert {:ok, updated} = Castmill.Devices.update_device(device, %{orientation: angle})
      assert updated.orientation == angle
      assert Jason.decode!(Jason.encode!(updated))["orientation"] == angle
    end
  end

  test "rejects non-numeric, missing, fractional and unsupported values" do
    for angle <- [nil, "90", true, 45, 360, -90, 90.0] do
      changeset = Device.update_changeset(%Device{}, %{"orientation" => angle})
      refute changeset.valid?
      assert Keyword.has_key?(changeset.errors, :orientation)
    end
  end

  test "unrelated updates preserve the existing orientation" do
    changeset = Device.update_changeset(%Device{orientation: 270}, %{name: "New name"})
    assert changeset.valid?
    assert Ecto.Changeset.get_field(changeset, :orientation) == 270
  end

  test "database constraint prevents invalid orientation outside the update validator" do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    device = device_fixture(%{organization_id: organization.id})

    changeset =
      device
      |> Ecto.Changeset.change(orientation: 45)
      |> Ecto.Changeset.check_constraint(:orientation, name: :devices_orientation_degrees)

    assert {:error, rejected} = Castmill.Repo.update(changeset)
    assert Keyword.has_key?(rejected.errors, :orientation)
  end
end
