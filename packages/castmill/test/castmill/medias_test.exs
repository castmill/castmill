defmodule Castmill.MediasTest do
  use Castmill.DataCase

  @moduletag :media_data_case

  alias Castmill.Resources

  describe "medias" do
    @describetag :medias

    alias Castmill.Resources.Media

    import Castmill.NetworksFixtures
    import Castmill.OrganizationsFixtures
    import Castmill.MediasFixtures

    test "list_medias/1 returns all medias" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media = media_fixture(%{organization_id: organization.id})

      assert Resources.list_resource(Media, organization.id) == [media]
    end

    test "update_media/1 updates the media but only the name" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media = media_fixture(%{organization_id: organization.id})

      assert Resources.list_resource(Media, organization.id) == [media]

      update_attrs = %{name: "some updated name"}

      assert {:ok, media} = Resources.update_media(media, update_attrs)
      assert media.name == "some updated name"
    end

    test "delete_media/1 deletes media" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media = media_fixture(%{organization_id: organization.id})

      assert Resources.list_resource(Media, organization.id) == [media]

      Resources.delete_media(media)

      assert Resources.list_resource(Media, organization.id) == []
    end
  end
end
