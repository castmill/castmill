defmodule CastmillWeb.ResourceController.PlaylistsTest do
  use CastmillWeb.ConnCase, async: true

  alias Castmill.Teams

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.TeamsFixtures
  import Castmill.PlaylistsFixtures

  @moduletag :e2e

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    team = team_fixture(%{organization_id: organization.id})
    {:ok, _result} = Teams.add_user_to_team(team.id, user.id, :regular)

    access_token =
      access_token_fixture(%{secret: "testuser:testpass", user_id: user.id, is_root: true})

    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> put_req_header("authorization", "Bearer #{access_token.secret}")

    {:ok, conn: conn, user: user, organization: organization, team: team}
  end

  describe "list playlists" do
    test "lists all playlists", %{conn: conn, organization: organization, team: team} do
      playlist1 =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "playlist1"
        })

      {:ok, _result} = Teams.add_resource_to_team(team.id, "playlists", playlist1.id, [:read])

      conn = get(conn, "/api/organizations/#{organization.id}/playlists")
      response = json_response(conn, 200)

      assert %{
               "data" => [
                 %{
                   "name" => "playlist1"
                 }
               ],
               "count" => 1
             } = response
    end

    test "lists playlists with pagination", %{conn: conn, organization: organization} do
      # Create some playlist items
      for i <- 1..5 do
        playlist_fixture(%{
          organization_id: organization.id,
          name: "playlist#{i}"
        })
      end

      # Request the first page with 2 items per page
      conn =
        get(conn, "/api/organizations/#{organization.id}/playlists", %{page: 1, page_size: 2})

      response = json_response(conn, 200)

      # Assert the first page contains the first 2 items
      assert %{"data" => [%{"name" => "playlist1"}, %{"name" => "playlist2"}], "count" => 5} =
               response

      # Request the second page
      conn =
        get(conn, "/api/organizations/#{organization.id}/playlists", %{page: 2, page_size: 2})

      response = json_response(conn, 200)

      # Assert the second page contains the next 2 items
      assert %{"data" => [%{"name" => "playlist3"}, %{"name" => "playlist4"}], "count" => 5} =
               response
    end

    test "searches playlists by name", %{conn: conn, organization: organization} do
      # Create some playlist items
      playlist_fixture(%{
        organization_id: organization.id,
        name: "rock playlist"
      })

      playlist_fixture(%{
        organization_id: organization.id,
        name: "pop playlist"
      })

      # Search for playlists with the term "rock"
      conn = get(conn, "/api/organizations/#{organization.id}/playlists", %{search: "rock"})
      response = json_response(conn, 200)

      # Assert only the "rock playlist" is returned
      assert %{"data" => [%{"name" => "rock playlist"}], "count" => 1} = response
    end

    test "searches playlists by name and applies pagination", %{
      conn: conn,
      organization: organization
    } do
      # Create some playlist items with names containing "rock"
      for i <- 1..5 do
        playlist_fixture(%{
          organization_id: organization.id,
          name: "rock playlist#{i}"
        })
      end

      # Create some playlist items without the search term
      for i <- 1..5 do
        playlist_fixture(%{
          organization_id: organization.id,
          name: "pop playlist#{i}"
        })
      end

      # Search for playlists with the term "rock" and request the first page with 2 items per page
      conn =
        get(conn, "/api/organizations/#{organization.id}/playlists", %{
          search: "rock",
          page: 1,
          page_size: 2
        })

      response = json_response(conn, 200)

      # Assert the first page contains the first 2 "rock" playlist items
      assert %{
               "data" => [%{"name" => "rock playlist1"}, %{"name" => "rock playlist2"}],
               "count" => 5
             } = response

      # Request the second page with the same search term
      conn =
        get(conn, "/api/organizations/#{organization.id}/playlists", %{
          search: "rock",
          page: 2,
          page_size: 2
        })

      response = json_response(conn, 200)

      # Assert the second page contains the next 2 "rock" playlist items
      assert %{
               "data" => [%{"name" => "rock playlist3"}, %{"name" => "rock playlist4"}],
               "count" => 5
             } = response
    end
  end

  describe "create playlists" do
    test "creates a new playlist", %{conn: conn, organization: organization} do
      playlist_params = %{
        "playlist" => %{
          "name" => "playlist name"
        }
      }

      conn = post(conn, "/api/organizations/#{organization.id}/playlists", playlist_params)
      response = json_response(conn, 201)

      assert %{
               "data" => %{
                 "name" => "playlist name"
               }
             } = response
    end

    test "fails to create a new playlist when data is incomplete", %{
      conn: conn,
      organization: organization
    } do
      # Assuming the name is required but missing here
      incomplete_playlist_params = %{
        "playlist" => %{
          "description" => "A collection of videos"
        }
      }

      conn =
        post(conn, "/api/organizations/#{organization.id}/playlists", incomplete_playlist_params)

      response = json_response(conn, 422)

      # Adjust the assertion based on your error response structure
      assert response["errors"] != nil
    end
  end

  describe "delete playlist" do
    test "deletes an existing playlist successfully", %{conn: conn, organization: organization} do
      # Assuming the playlist object is created earlier
      playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "playlist1"
        })

      # Deleting the playlist object
      conn = delete(conn, "/api/organizations/#{organization.id}/playlists/#{playlist.id}")
      assert response(conn, 204)

      # Verifying the playlist object is deleted by checking if it's still in the list
      conn = get(conn, "/api/organizations/#{organization.id}/playlists")
      response = json_response(conn, 200)

      assert %{"count" => 0} = response
    end

    test "fails to delete a non-existent playlist", %{conn: conn, organization: organization} do
      # Attempting to delete a playlist object with an invalid ID
      conn = delete(conn, "/api/organizations/#{organization.id}/playlists/0")
      assert response(conn, 404)

      # Verifying the response message
      response = json_response(conn, 404)
      assert %{"errors" => ["Playlist not found"]} = response
    end
  end

  describe "full playlist lifecycle" do
    test "creates and retrieves a new playlist from the list", %{
      conn: conn,
      organization: organization
    } do
      # Creating a playlist object
      playlist_params = %{
        "playlist" => %{
          "name" => "Top Hits"
        }
      }

      conn = post(conn, "/api/organizations/#{organization.id}/playlists", playlist_params)
      response = json_response(conn, 201)

      assert %{
               "data" => %{
                 "name" => "Top Hits",
                 "id" => id
               }
             } = response

      # Retrieving the created playlist object from the list
      conn = get(conn, "/api/organizations/#{organization.id}/playlists")
      retrieval_response = json_response(conn, 200)

      assert %{
               "data" => [
                 %{
                   "name" => "Top Hits",
                   "id" => ^id
                 }
               ],
               "count" => 1
             } = retrieval_response
    end
  end
end
