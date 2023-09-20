defmodule CastmillWeb.FileControllerTest do
  use CastmillWeb.ConnCase, async: true

  alias Castmill.Repo
  alias Castmill.Files
  alias Castmill.Files.File
  alias Castmill.Resources.Media

  import Castmill.AccountsFixtures
  import Castmill.MediasFixtures
  import Castmill.FilesFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  @media_fixture %{
    mimetype: "image/png",
    name: "sample"
  }

  @file_fixture %{
    name: "file_name",
    size: 12345,
    uri: "some/uri",
    mimetype: "image/png"
  }

  setup %{conn: conn} do
    user = user_fixture()
    access_token = access_token_fixture(%{secret: "somesecret", user_id: user.id})

    # Put the token in the Authorization header
    conn = put_req_header(conn, "authorization", "Bearer #{access_token.secret}")

    {:ok, conn: conn}
  end

  describe "index" do
    test "lists all files for a media", %{conn: conn} do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      media_changeset =
        Media.changeset(%Media{}, Map.merge(@media_fixture, %{organization_id: organization.id}))

      {:ok, media} = Repo.insert(media_changeset)

      file_changeset =
        File.changeset(%File{}, Map.merge(@file_fixture, %{organization_id: organization.id}))

      {:ok, file} = Repo.insert(file_changeset)
      Files.add_file_to_media(file.id, media.id, "thumbnail")

      conn = get(conn, ~p"/api/organizations/#{organization.id}/medias/#{media.id}/files")

      expected_data = [
        %{
          "id" => file.id,
          "name" => @file_fixture.name,
          "uri" => @file_fixture.uri,
          "size" => @file_fixture.size,
          "mimetype" => @file_fixture.mimetype
        }
      ]

      assert json_response(conn, 200)["data"] == expected_data
    end
  end

  describe "create" do
    test "creates a file for a media", %{conn: conn} do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      media_changeset =
        Media.changeset(%Media{}, Map.merge(@media_fixture, %{organization_id: organization.id}))

      {:ok, media} = Repo.insert(media_changeset)

      conn =
        post(
          conn,
          ~p"/api/organizations/#{organization.id}/medias/#{media.id}/files",
          Map.merge(@file_fixture, %{organization_id: organization.id})
        )

      assert json_response(conn, 201)["status"] == "success"

      # Fetch the media again from the database
      files = Files.get_media_files(media.id)

      # Check that there is exactly one file and that it has the expected properties
      assert length(files) == 1

      file = Enum.at(files, 0)

      assert file.name == @file_fixture.name
      assert file.size == @file_fixture.size
      assert file.uri == @file_fixture.uri
      assert file.mimetype == @file_fixture.mimetype
    end

    test "creates a file for a media ignores media_id in body", %{conn: conn} do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      media_changeset =
        Media.changeset(%Media{}, Map.merge(@media_fixture, %{organization_id: organization.id}))

      {:ok, media} = Repo.insert(media_changeset)

      conn =
        post(
          conn,
          ~p"/api/organizations/#{organization.id}/medias/#{media.id}/files",
          Map.merge(@file_fixture, %{media_id: "some_other_id"})
        )

      assert json_response(conn, 201)["status"] == "success"

      # Fetch the media again from the database
      files = Files.get_media_files(media.id)

      # Check that there is exactly one file and that it has the expected properties
      assert length(files) == 1

      file = Enum.at(files, 0)

      assert file.name == @file_fixture.name
      assert file.size == @file_fixture.size
      assert file.uri == @file_fixture.uri
      assert file.mimetype == @file_fixture.mimetype
    end

    test "returns changeset error for missing fields", %{conn: conn} do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      media = media_fixture(%{organization_id: organization.id})

      incomplete_file_data = %{
        "name" => "incomplete_file",
        "mimetype" => "image/png"
        # size is missing
        # uri is missing
      }

      conn =
        post(
          conn,
          ~p"/api/organizations/#{organization.id}/medias/#{media.id}/files",
          incomplete_file_data
        )

      response_body = json_response(conn, 422)

      assert Enum.member?(response_body["errors"]["size"], "can't be blank")
      assert Enum.member?(response_body["errors"]["uri"], "can't be blank")
    end
  end

  describe "delete" do
    test "deletes a file for a media", %{conn: conn} do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      media = media_fixture(%{organization_id: organization.id})
      {:ok, file} = file_fixture(%{organization_id: organization.id})
      Files.add_file_to_media(file.id, media.id, "thumbnail")

      conn =
        delete(
          conn,
          ~p"/api/organizations/#{organization.id}/medias/#{media.id}/files/#{file.id}"
        )

      assert conn.status == 204

      # Fetch the media's files again from the database
      files = Files.get_media_files(media.id)

      assert Enum.empty?(files)
    end
  end
end
