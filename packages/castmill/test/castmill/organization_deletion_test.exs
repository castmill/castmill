defmodule Castmill.OrganizationDeletionTest do
  use Castmill.DataCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.DevicesFixtures
  import Castmill.MediasFixtures

  alias Castmill.Organizations

  setup do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    %{network: network, organization: organization}
  end

  # A media file stored on local disk, as uploads are in tests.
  defp stored_file(organization) do
    name = "deletion-#{System.unique_integer([:positive])}.png"
    dir = Path.join([Application.app_dir(:castmill), "priv", "static", "medias", organization.id])
    File.mkdir_p!(dir)
    path = Path.join(dir, name)
    File.write!(path, "png")

    media =
      media_fixture(%{name: "Logo", organization_id: organization.id, mimetype: "image/png"})

    {:ok, file} =
      Castmill.Files.create_file(%{
        name: name,
        uri: "http://localhost/medias/#{organization.id}/#{name}",
        size: 3,
        mimetype: "image/png",
        organization_id: organization.id
      })

    Repo.insert!(%Castmill.Files.FilesMedias{
      file_id: file.id,
      media_id: media.id,
      context: "default"
    })

    on_exit(fn -> File.rm_rf(dir) end)
    path
  end

  defp eventually(fun, attempts \\ 50) do
    cond do
      fun.() -> true
      attempts == 0 -> false
      true -> Process.sleep(20) && eventually(fun, attempts - 1)
    end
  end

  test "deletes the organization, notifies its players and frees its stored files", %{
    network: network,
    organization: organization
  } do
    device = device_fixture(%{organization_id: organization.id})
    Phoenix.PubSub.subscribe(Castmill.PubSub, "devices:#{device.id}")
    path = stored_file(organization)
    member = user_fixture(%{network_id: network.id})
    {:ok, _} = Organizations.add_user(organization.id, member.id, :member)

    test_pid = self()

    {:ok, hook_id} =
      Castmill.Hooks.register_hook(:organization_deleted, fn args ->
        send(test_pid, {:organization_deleted, args})
      end)

    on_exit(fn -> Castmill.Hooks.unregister_hook(:organization_deleted, hook_id) end)

    assert {:ok, _} = Organizations.delete_organization(organization)

    assert_receive %{command: "device_removed"}
    refute Organizations.get_organization(organization.id)
    refute Castmill.Devices.get_device(device.id)

    assert Repo.all(from(f in Castmill.Files.File, where: f.organization_id == ^organization.id)) ==
             []

    assert eventually(fn -> not File.exists?(path) end)

    org_id = organization.id
    network_id = network.id
    assert_receive {:organization_deleted, %{organization_id: ^org_id, network_id: ^network_id}}

    # Former members are told directly: the organization cannot be referenced.
    name = organization.name

    assert [
             %{
               type: "organization_deleted",
               metadata: %{"organization_name" => ^name, "device_count" => 1}
             }
           ] =
             Repo.all(
               from(n in Castmill.Notifications.Notification, where: n.user_id == ^member.id)
             )
  end

  test "refuses organizations with child organizations", %{
    network: network,
    organization: organization
  } do
    organization_fixture(%{
      network_id: network.id,
      organization_id: organization.id,
      name: "Child"
    })

    assert {:error, :has_child_organizations} = Organizations.delete_organization(organization)
    assert Organizations.get_organization(organization.id)
  end

  test "does not touch other organizations", %{network: network, organization: organization} do
    other = organization_fixture(%{network_id: network.id, name: "Other organization"})
    other_device = device_fixture(%{organization_id: other.id})

    {:ok, _} = Organizations.delete_organization(organization)

    assert Organizations.get_organization(other.id)
    assert Castmill.Devices.get_device(other_device.id)
  end
end
