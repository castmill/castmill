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

      assert Resources.list_resources(Media, %{organization_id: organization.id}) == [media]
    end

    test "update_media/1 updates the media but only the name" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media = media_fixture(%{organization_id: organization.id})

      assert Resources.list_resources(Media, %{organization_id: organization.id}) == [media]

      update_attrs = %{name: "some updated name"}

      assert {:ok, media} = Resources.update_media(media, update_attrs)
      assert media.name == "some updated name"
    end

    test "delete_media/1 deletes media" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media = media_fixture(%{organization_id: organization.id})

      assert Resources.list_resources(Media, %{organization_id: organization.id}) == [media]

      Resources.delete_media(media)

      assert Resources.list_resources(Media, %{organization_id: organization.id}) == []
    end

    test "update_media/1 updates the media's status and status_message" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media = media_fixture(%{organization_id: organization.id})

      update_attrs = %{status: :transcoding, status_message: "Transcoding started"}

      assert {:ok, media} = Resources.update_media(media, update_attrs)
      assert media.status == :transcoding
      assert media.status_message == "Transcoding started"
    end

    test "changeset with :failed status requires status_message" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      invalid_attrs = %{
        name: "media1",
        mimetype: "video/mp4",
        organization_id: organization.id,
        status: :failed
      }

      {:error, changeset} = Resources.create_media(invalid_attrs)
      assert %Ecto.Changeset{valid?: false, errors: errors} = changeset
      assert {:status_message, {"must be present when status is :failed", []}} in errors
    end

    test "changeset with non-failed status allows nil status_message" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      valid_attrs = %{
        name: "media2",
        mimetype: "video/mp4",
        organization_id: organization.id,
        status: :uploading
      }

      assert {:ok, _media} = Resources.create_media(valid_attrs)
    end

    test "update_media/1 updates the media's transcoding status and progress message" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media = media_fixture(%{organization_id: organization.id})

      update_attrs = %{status: :transcoding, status_message: "30% completed"}

      assert {:ok, media} = Resources.update_media(media, update_attrs)
      assert media.status == :transcoding
      assert media.status_message == "30% completed"
    end

    test "changeset with :transcoding status requires status_message" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      invalid_attrs = %{
        name: "media1",
        mimetype: "video/mp4",
        organization_id: organization.id,
        status: :transcoding
      }

      {:error, changeset} = Resources.create_media(invalid_attrs)
      assert %Ecto.Changeset{valid?: false, errors: errors} = changeset
      assert {:status_message, {"must be present when status is :transcoding", []}} in errors
    end
  end
end
