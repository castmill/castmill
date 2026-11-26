defmodule Castmill.AccountDeletionTest do
  @moduledoc """
  Deleting an account deletes the organizations it is the only member of,
  with the same cleanup as deleting an organization.
  """
  use Castmill.DataCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures

  alias Castmill.{Accounts, Organizations}

  setup do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{network_id: network.id})
    {:ok, _} = Organizations.add_user(organization.id, user.id, :admin)

    test_pid = self()

    {:ok, hook_id} =
      Castmill.Hooks.register_hook(:organization_deleted, fn args ->
        send(test_pid, {:organization_deleted, args})
      end)

    on_exit(fn -> Castmill.Hooks.unregister_hook(:organization_deleted, hook_id) end)

    %{network: network, organization: organization, user: user}
  end

  test "the organizations only the user is in are deleted with full cleanup", %{
    network: network,
    organization: organization,
    user: user
  } do
    device = device_fixture(%{organization_id: organization.id})
    Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")

    assert {:ok, _} = Accounts.delete_user(user.id)

    refute Accounts.get_user(user.id)
    refute Organizations.get_organization(organization.id)
    refute Castmill.Devices.get_device(device.id)

    # Players reset and the hook runs (for example to cancel a subscription).
    assert_receive %{command: "device_removed"}
    org_id = organization.id
    network_id = network.id
    assert_receive {:organization_deleted, %{organization_id: ^org_id, network_id: ^network_id}}

    # The deleted user is not notified about their own organization.
    assert Repo.all(Castmill.Notifications.Notification) |> Enum.filter(&(&1.user_id == user.id)) ==
             []
  end

  test "organizations with other people are kept, and no hook runs", %{
    network: network,
    organization: organization,
    user: user
  } do
    other = user_fixture(%{network_id: network.id})
    {:ok, _} = Organizations.add_user(organization.id, other.id, :admin)

    assert {:ok, _} = Accounts.delete_user(user.id)

    assert Organizations.get_organization(organization.id)
    refute_received {:organization_deleted, _}
  end

  test "an organization with child organizations refuses the deletion and nothing changes", %{
    network: network,
    organization: organization,
    user: user
  } do
    # Another organization of the user, possibly deleted first, must come back too.
    other_organization = organization_fixture(%{network_id: network.id, name: "Second"})
    {:ok, _} = Organizations.add_user(other_organization.id, user.id, :admin)

    organization_fixture(%{
      network_id: network.id,
      organization_id: organization.id,
      name: "Child"
    })

    name = organization.name

    assert {:error, {:has_child_organizations, ^name}} = Accounts.delete_user(user.id)

    assert Accounts.get_user(user.id)
    assert Organizations.get_organization(organization.id)
    assert Organizations.get_organization(other_organization.id)
    refute_received {:organization_deleted, _}
  end
end
