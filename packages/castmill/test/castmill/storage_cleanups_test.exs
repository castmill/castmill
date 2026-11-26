defmodule Castmill.StorageCleanupsTest do
  use Castmill.DataCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.StorageCleanups
  alias Castmill.StorageCleanups.StorageCleanup
  alias Castmill.Widgets.AssetStorage

  defp asset_dir(slug) do
    dir = AssetStorage.widget_assets_dir(slug)
    File.mkdir_p!(dir)
    File.write!(Path.join(dir, "logo.png"), "png")
    on_exit(fn -> File.rm_rf(dir) end)
    dir
  end

  test "deletes recorded objects and forgets them" do
    slug = "cleanup-#{System.unique_integer([:positive])}"
    dir = asset_dir(slug)

    [id] = StorageCleanups.record([{"widget_assets", %{"slug" => slug}}])
    assert %{done: 1, failed: 0} = StorageCleanups.run([id])

    refute File.exists?(dir)
    assert Repo.all(StorageCleanup) == []
  end

  test "keeps assets of a slug that a widget uses again" do
    slug = "reused-#{System.unique_integer([:positive])}"
    dir = asset_dir(slug)
    {:ok, _} = Castmill.Widgets.create_widget(%{name: "Reused", slug: slug, template: %{}})

    StorageCleanups.record([{"widget_assets", %{"slug" => slug}}])
    assert %{done: 1} = StorageCleanups.run()
    assert File.exists?(dir)
  end

  test "keeps failed cleanups for a later retry" do
    [id] = StorageCleanups.record([{"unknown", %{}}])

    assert %{done: 0, failed: 1} = StorageCleanups.run([id])
    assert %StorageCleanup{attempts: 1, last_error: error} = Repo.get(StorageCleanup, id)
    assert error =~ "unknown_cleanup"

    assert %{failed: 1} = StorageCleanups.run()
    assert %StorageCleanup{attempts: 2} = Repo.get(StorageCleanup, id)
  end

  test "deleting an organization removes its own widgets' assets", _ do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    slug = "org-widget-#{System.unique_integer([:positive])}"
    dir = asset_dir(slug)

    {:ok, widget} = Castmill.Widgets.create_widget(%{name: "Own", slug: slug, template: %{}})

    {:ok, _} =
      Castmill.Widgets.set_widget_scope(widget, %{organization_id: organization.id})

    {:ok, _} = Castmill.Organizations.delete_organization(organization)

    refute File.exists?(dir)
    assert Repo.all(StorageCleanup) == []
  end
end
