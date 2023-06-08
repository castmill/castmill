defmodule Castmill.FilesTest do
  use Castmill.DataCase

  @moduletag :files_data_case

  describe "files" do
    @describetag :files

    alias Castmill.Files

    import Castmill.NetworksFixtures
    import Castmill.OrganizationsFixtures
    import Castmill.FilesFixtures
    import Castmill.MediasFixtures

    test "list_files/0 returns all files in the system" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, file1} =
        file_fixture(%{
          organization_id: organization.id,
          uri: "https://www.youtube.com/watch?v=1",
          name: "file1"
        })

      {:ok, file2} =
        file_fixture(%{
          organization_id: organization.id,
          uri: "https://www.youtube.com/watch?v=2",
          name: "file2"
        })

      {:ok, file3} =
        file_fixture(%{
          organization_id: organization.id,
          uri: "https://www.youtube.com/watch?v=3",
          name: "file3"
        })

      files = Files.list_files()
      assert length(files) == 3
      assert file1 in files
      assert file2 in files
      assert file3 in files
    end

    test "list_files/1 returns all files in an organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, file1} =
        file_fixture(%{
          organization_id: organization.id,
          uri: "https://www.youtube.com/watch?v=1",
          name: "file1"
        })

      {:ok, file2} =
        file_fixture(%{
          organization_id: organization.id,
          uri: "https://www.youtube.com/watch?v=2",
          name: "file2"
        })

      {:ok, file3} =
        file_fixture(%{
          organization_id: organization.id,
          uri: "https://www.youtube.com/watch?v=3",
          name: "file3"
        })

      files = Files.list_files(organization.id)
      assert length(files) == 3
      assert file1 in files
      assert file2 in files
      assert file3 in files
    end

    test "get_total_size/1 returns the total size of the files in one organization" do
      network = network_fixture()
      organization1 = organization_fixture(%{name: "organization 1", network_id: network.id})
      organization2 = organization_fixture(%{name: "organization 2", network_id: network.id})

      {:ok, _file1} =
        file_fixture(%{
          organization_id: organization1.id,
          uri: "https://www.youtube.com/watch?v=1",
          name: "file1",
          size: 100
        })

      {:ok, _file2} =
        file_fixture(%{
          organization_id: organization1.id,
          uri: "https://www.youtube.com/watch?v=2",
          name: "file2",
          size: 200
        })

      {:ok, _file3} =
        file_fixture(%{
          organization_id: organization1.id,
          uri: "https://www.youtube.com/watch?v=3",
          name: "file3",
          size: 300
        })

      assert Files.get_total_size(organization1.id) == 600
      assert Files.get_total_size(organization2.id) == 0
    end

    test "delete_file/2 deletes a given file from a given organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, file1} =
        file_fixture(%{
          organization_id: organization.id,
          uri: "https://www.youtube.com/watch?v=1",
          name: "file1"
        })

      {:ok, file2} =
        file_fixture(%{
          organization_id: organization.id,
          uri: "https://www.youtube.com/watch?v=2",
          name: "file2"
        })

      Files.delete_file(file1.id, organization.id)

      assert Files.list_files(organization.id) == [file2]
    end

    test "delete_file/1 deletes a given file" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, file1} =
        file_fixture(%{
          organization_id: organization.id,
          uri: "https://www.youtube.com/watch?v=1",
          name: "file1"
        })

      {:ok, file2} =
        file_fixture(%{
          organization_id: organization.id,
          uri: "https://www.youtube.com/watch?v=2",
          name: "file2"
        })

      Files.delete_file(file1.id)

      assert Files.list_files(organization.id) == [file2]
    end

    test "add_file_to_media/3 associates a file to a given media with a given contest" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, file} =
        file_fixture(%{
          organization_id: organization.id,
          uri: "https://www.youtube.com/watch?v=1",
          name: "file1"
        })

      media =
        media_fixture(%{
          organization_id: organization.id,
          uri: "https://www.youtube.com/watch?v=1"
        })

      assert Files.add_file_to_media(file.id, media.id, "some context")

      assert Files.get_media_file(media.id, "some context") == file

      assert Files.get_media_files(media.id) == [file]
    end
  end
end
