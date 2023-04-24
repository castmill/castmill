defmodule Castmill.MediasTest do
  use Castmill.DataCase

  @moduletag :playlist_data_case

  alias Castmill.Resources
  alias Castmill.Medias.Media

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.MediasFixtures

  describe "medias" do
    @describetag :medias


    test "list_medias/1 returns all medias" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media = media_fixture(%{organization_id: organization.id, uri: "https://www.youtube.com/watch?v=1"})

      assert Resources.list_medias(organization.id) == [media]
    end

    test "update_media/1 updates the media but only the name" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media = media_fixture(%{organization_id: organization.id, uri: "https://www.youtube.com/watch?v=1"})

      assert Resources.list_medias(organization.id) == [media]

      update_attrs = %{name: "some updated name"}

      assert {:ok, media} = Resources.update_media(media, update_attrs)
      assert media.name == "some updated name"
      assert media.uri == "https://www.youtube.com/watch?v=1"
    end

    test "delete_media/1 deletes media" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media = media_fixture(%{organization_id: organization.id, uri: "https://www.youtube.com/watch?v=1"})

      assert Resources.list_medias(organization.id) == [media]

      Resources.delete_media(media)

      assert Resources.list_medias(organization.id) == []
    end
  end

  describe "pagination" do
    @describetag :pagination

    test "list_medias/2 returns the specified number of medias" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media1 = media_fixture(%{organization_id: organization.id})
      media2 = media_fixture(%{organization_id: organization.id})
      media3 = media_fixture(%{organization_id: organization.id})
      media4 = media_fixture(%{organization_id: organization.id})

      assert Resources.list_medias(organization.id, 2) == [media1, media2]
    end

    test "list_medias/2 returns all medias when the limit is greater than the number of medias" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media1 = media_fixture(%{organization_id: organization.id})
      media2 = media_fixture(%{organization_id: organization.id})

      assert Resources.list_medias(organization.id, 3) == [media1, media2]
    end

    test "list_medias/3 returns the specified number of medias starting from the offset" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media1 = media_fixture(%{organization_id: organization.id})
      media2 = media_fixture(%{organization_id: organization.id})
      media3 = media_fixture(%{organization_id: organization.id})
      media4 = media_fixture(%{organization_id: organization.id})
      media5 = media_fixture(%{organization_id: organization.id})

      assert Resources.list_medias(organization.id, 2, 2) == [media3, media4]
    end

    test "list_medias/3 returns all medias when the limit is greater than the number of medias" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media1 = media_fixture(%{organization_id: organization.id})
      media2 = media_fixture(%{organization_id: organization.id})
      media3 = media_fixture(%{organization_id: organization.id})
      media4 = media_fixture(%{organization_id: organization.id})

      assert Resources.list_medias(organization.id, 3, 2) == [media3, media4]
    end
  end
end
