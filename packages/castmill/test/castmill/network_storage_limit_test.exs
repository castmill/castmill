defmodule Castmill.NetworkStorageLimitTest do
  use Castmill.DataCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.MediasFixtures
  import Castmill.FilesFixtures

  alias Castmill.{Networks, Quotas}

  @mb 1024 * 1024

  defp store(organization, bytes) do
    media =
      media_fixture(%{name: "Media", organization_id: organization.id, mimetype: "image/png"})

    {:ok, file} =
      file_fixture(%{
        name: "file.png",
        organization_id: organization.id,
        size: bytes,
        mimetype: "image/png",
        uri: "s3://bucket/#{System.unique_integer([:positive])}.png"
      })

    Repo.insert!(%Castmill.Files.FilesMedias{
      file_id: file.id,
      media_id: media.id,
      context: "default"
    })
  end

  setup do
    network = network_fixture()
    org_a = organization_fixture(%{network_id: network.id, name: "Organization A"})
    org_b = organization_fixture(%{network_id: network.id, name: "Organization B"})
    %{network: network, org_a: org_a, org_b: org_b}
  end

  test "the network's organizations share its storage limit", %{
    network: network,
    org_a: org_a,
    org_b: org_b
  } do
    {:ok, _} = Networks.set_storage_limit(network, 10)
    store(org_a, 6 * @mb)

    assert Quotas.get_network_storage_used(network.id) == 6 * @mb
    assert Quotas.check_storage(org_b.id, 4 * @mb) == :ok
    assert Quotas.check_storage(org_b.id, 5 * @mb) == {:error, :network_storage_exceeded}
  end

  test "networks without a limit only apply the organization quota", %{org_a: org_a} do
    store(org_a, 6 * @mb)

    assert Quotas.check_storage(org_a.id, 100 * @mb) == :ok
    assert Quotas.check_storage(org_a.id, 2_000 * @mb) == {:error, :quota_exceeded}
  end

  test "the organization quota still applies under a larger network limit", %{
    network: network,
    org_a: org_a
  } do
    {:ok, _} = Networks.set_storage_limit(network, 100_000)
    Quotas.add_quota_to_organization(org_a.id, :storage, 5)

    assert Quotas.check_storage(org_a.id, 6 * @mb) == {:error, :quota_exceeded}
  end

  test "other networks' storage does not count", %{network: network, org_a: org_a} do
    {:ok, _} = Networks.set_storage_limit(network, 10)
    other = organization_fixture(%{network_id: network_fixture().id})
    store(other, 50 * @mb)

    assert Quotas.check_storage(org_a.id, 10 * @mb) == :ok
  end

  test "is not part of the network settings and rejects negative limits", %{network: network} do
    changeset = Castmill.Networks.Network.changeset(network, %{"max_storage_mb" => 1})
    refute Map.has_key?(changeset.changes, :max_storage_mb)
    assert {:error, _} = Networks.set_storage_limit(network, -1)
    assert {:ok, %{max_storage_mb: nil}} = Networks.set_storage_limit(network, nil)
  end
end
