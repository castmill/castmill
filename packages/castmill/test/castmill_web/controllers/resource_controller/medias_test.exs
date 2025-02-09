defmodule CastmillWeb.ResourceController.MediasTest do
  use CastmillWeb.ConnCase, async: true

  alias Castmill.Teams

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.TeamsFixtures
  import Castmill.MediasFixtures

  @moduletag :e2e

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    team = team_fixture(%{organization_id: organization.id})
    {:ok, _result} = Teams.add_user_to_team(team.id, user.id, :regular)
    # {:ok, _result} = Teams.add_resource_to_team(team.id, media.id, :media, [:read])

    # TODO: change this to a non-root user
    # access_token = access_token_fixture(%{secret: "testuser:testpass", user_id: user.id})
    access_token =
      access_token_fixture(%{secret: "testuser:testpass", user_id: user.id, is_root: true})

    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> put_req_header("authorization", "Bearer #{access_token.secret}")

    {:ok, conn: conn, user: user, organization: organization, team: team}
  end

  describe "list medias" do
    test "lists all medias", %{conn: conn, organization: organization} do
      media_fixture(%{
        organization_id: organization.id,
        name: "media1",
        uri: "http://youtube.com",
        mime_type: "video/mp4"
      })

      conn = get(conn, "/api/organizations/#{organization.id}/medias")
      response = json_response(conn, 200)

      assert %{
               "data" => [
                 %{
                   "name" => "media1",
                   "mimetype" => "video/mp4",
                   "meta" => nil
                 }
               ],
               "count" => 1
             } = response
    end

    test "lists medias with pagination", %{conn: conn, organization: organization} do
      # Create some media items
      for i <- 1..5 do
        media_fixture(%{
          organization_id: organization.id,
          name: "media#{i}",
          uri: "http://example.com/#{i}",
          mime_type: "video/mp4"
        })
      end

      # Request the first page with 2 items per page
      conn = get(conn, "/api/organizations/#{organization.id}/medias", %{page: 1, page_size: 2})
      response = json_response(conn, 200)

      # Assert the first page contains the first 2 items
      assert %{"data" => [%{"name" => "media1"}, %{"name" => "media2"}], "count" => 5} = response

      # Request the second page
      conn = get(conn, "/api/organizations/#{organization.id}/medias", %{page: 2, page_size: 2})
      response = json_response(conn, 200)

      # Assert the second page contains the next 2 items
      assert %{"data" => [%{"name" => "media3"}, %{"name" => "media4"}], "count" => 5} = response
    end

    test "searches medias by name", %{conn: conn, organization: organization} do
      # Create some media items
      media_fixture(%{
        organization_id: organization.id,
        name: "big media",
        uri: "http://example.com/big",
        mime_type: "video/mp4"
      })

      media_fixture(%{
        organization_id: organization.id,
        name: "small media",
        uri: "http://example.com/small",
        mime_type: "video/mp4"
      })

      # Search for medias with the term "big"
      conn = get(conn, "/api/organizations/#{organization.id}/medias", %{search: "big"})
      response = json_response(conn, 200)

      # Assert only the "big media" is returned
      assert %{"data" => [%{"name" => "big media"}], "count" => 1} = response
    end

    test "searches medias by name and applies pagination", %{
      conn: conn,
      organization: organization
    } do
      # Create some media items with names containing "big"
      for i <- 1..5 do
        media_fixture(%{
          organization_id: organization.id,
          name: "big media#{i}",
          uri: "http://example.com/big#{i}",
          mime_type: "video/mp4"
        })
      end

      # Create some media items without the search term
      for i <- 1..5 do
        media_fixture(%{
          organization_id: organization.id,
          name: "small media#{i}",
          uri: "http://example.com/small#{i}",
          mime_type: "video/mp4"
        })
      end

      # Search for medias with the term "big" and request the first page with 2 items per page
      conn =
        get(conn, "/api/organizations/#{organization.id}/medias", %{
          search: "big",
          page: 1,
          page_size: 2
        })

      response = json_response(conn, 200)

      # Assert the first page contains the first 2 "big" media items
      assert %{"data" => [%{"name" => "big media1"}, %{"name" => "big media2"}], "count" => 5} =
               response

      # Request the second page with the same search term
      conn =
        get(conn, "/api/organizations/#{organization.id}/medias", %{
          search: "big",
          page: 2,
          page_size: 2
        })

      response = json_response(conn, 200)

      # Assert the second page contains the next 2 "big" media items
      assert %{"data" => [%{"name" => "big media3"}, %{"name" => "big media4"}], "count" => 5} =
               response
    end
  end

  describe "create medias" do
    test "creates a new media", %{conn: conn, organization: organization} do
      media_params = %{
        "media" => %{
          "name" => "big bunny",
          "uri" => "https://somewhere.in.the.internet.com",
          "size" => "123456789",
          "mimetype" => "video/mpeg4"
        }
      }

      conn = post(conn, "/api/organizations/#{organization.id}/medias", media_params)
      response = json_response(conn, 201)

      assert %{
               "data" => %{
                 "name" => "big bunny",
                 "id" => _id,
                 "meta" => nil,
                 "mimetype" => "video/mpeg4"
               }
             } = response
    end

    test "fails to create a new media when data is incomplete", %{
      conn: conn,
      organization: organization
    } do
      # Missing the "uri" and "size" fields
      incomplete_media_params = %{
        "media" => %{
          "mimetype" => "video/mpeg4"
        }
      }

      conn = post(conn, "/api/organizations/#{organization.id}/medias", incomplete_media_params)
      response = json_response(conn, 422)

      # You can add more specific assertions based on your error response structure
      assert response["errors"] != nil
    end
  end

  describe "delete media" do
    test "deletes an existing media successfully", %{conn: conn, organization: organization} do
      # Assuming the media object is created earlier
      media =
        media_fixture(%{
          organization_id: organization.id,
          name: "media1",
          uri: "http://youtube.com",
          mime_type: "video/mp4"
        })

      # Deleting the media object
      conn = delete(conn, "/api/organizations/#{organization.id}/medias/#{media.id}")
      assert response(conn, 204)

      # Verifying the media object is deleted by checking if it's still in the list
      conn = get(conn, "/api/organizations/#{organization.id}/medias")
      response = json_response(conn, 200)

      assert %{"count" => 0} = response
    end

    test "fails to delete a non-existent media", %{conn: conn, organization: organization} do
      # Attempting to delete a media object with an invalid ID
      conn = delete(conn, "/api/organizations/#{organization.id}/medias/0")
      assert response(conn, 404)

      # Verifying the response message
      response = json_response(conn, 404)
      assert %{"errors" => ["Media not found"]} = response
    end
  end

  describe "full media lifecycle" do
    test "creates and retrieves a new media from the list", %{
      conn: conn,
      organization: organization
    } do
      # Creating a media object
      media_params = %{
        "media" => %{
          "name" => "big bunny",
          "uri" => "https://somewhere.in.the.internet.com",
          "size" => "123456789",
          "mimetype" => "video/mpeg4"
        }
      }

      conn = post(conn, "/api/organizations/#{organization.id}/medias", media_params)
      response = json_response(conn, 201)

      assert %{
               "data" => %{
                 "name" => "big bunny",
                 "id" => id,
                 "meta" => nil,
                 "mimetype" => "video/mpeg4"
               }
             } = response

      # Retrieving the created media object from the list
      conn = get(conn, "/api/organizations/#{organization.id}/medias")
      retrieval_response = json_response(conn, 200)

      assert %{
               "data" => [
                 %{
                   "name" => "big bunny",
                   "id" => ^id,
                   "meta" => nil,
                   "mimetype" => "video/mpeg4"
                 }
               ],
               "count" => 1
             } = retrieval_response
    end
  end
end
