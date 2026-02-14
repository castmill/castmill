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
    {:ok, _result} = Teams.add_user_to_team(team.id, user.id, :member)

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

    test "fails to delete a playlist used as default playlist in a channel", %{
      conn: conn,
      organization: organization
    } do
      import Castmill.ChannelsFixtures

      # Create a playlist
      playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "Test Playlist"
        })

      # Create a channel that uses this playlist as default
      channel =
        channel_fixture(%{
          organization_id: organization.id,
          name: "Test Channel",
          timezone: "UTC",
          default_playlist_id: playlist.id
        })

      # Attempt to delete the playlist
      conn = delete(conn, "/api/organizations/#{organization.id}/playlists/#{playlist.id}")
      assert response(conn, 409)

      # Verify the error response contains channel information
      response = json_response(conn, 409)

      assert %{
               "errors" => %{
                 "detail" => "Cannot delete playlist that is used in channels",
                 "channels" => channels
               }
             } = response

      # Verify channel information is in the response
      assert is_list(channels)
      assert length(channels) == 1
      [channel_info] = channels
      assert channel_info["name"] == channel.name
      assert channel_info["usage_type"] == "default"
    end

    test "allows deletion of a playlist used only in past channel entries", %{
      conn: conn,
      organization: organization
    } do
      import Castmill.ChannelsFixtures

      # Create a playlist
      playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "Test Playlist"
        })

      # Create a channel
      channel =
        channel_fixture(%{
          organization_id: organization.id,
          name: "Test Channel",
          timezone: "UTC"
        })

      # Add the playlist to a PAST channel entry
      _entry =
        channel_entry_fixture(channel.id, %{
          playlist_id: playlist.id,
          start: ~U[2024-01-01 10:00:00Z],
          end: ~U[2024-01-01 12:00:00Z]
        })

      # Attempt to delete the playlist - should succeed since entry is in the past
      conn = delete(conn, "/api/organizations/#{organization.id}/playlists/#{playlist.id}")
      assert response(conn, 204)
    end

    test "fails to delete a playlist used in a channel entry", %{
      conn: conn,
      organization: organization
    } do
      import Castmill.ChannelsFixtures

      # Create a playlist
      playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "Test Playlist"
        })

      # Create a channel
      channel =
        channel_fixture(%{
          organization_id: organization.id,
          name: "Test Channel",
          timezone: "UTC"
        })

      # Add the playlist to a channel entry (use future date, same week)
      # Calculate next Monday to ensure start and end fall within the same week
      now = DateTime.utc_now()
      day_of_week = Date.day_of_week(now)
      days_until_next_monday = rem(8 - day_of_week, 7)
      days_until_next_monday = if days_until_next_monday == 0, do: 7, else: days_until_next_monday
      future_start = DateTime.add(now, days_until_next_monday * 24 * 3600, :second)
      future_end = DateTime.add(future_start, 2 * 3600, :second)

      _entry =
        channel_entry_fixture(channel.id, %{
          playlist_id: playlist.id,
          start: future_start,
          end: future_end
        })

      # Attempt to delete the playlist
      conn = delete(conn, "/api/organizations/#{organization.id}/playlists/#{playlist.id}")
      assert response(conn, 409)

      # Verify the error response contains channel information
      response = json_response(conn, 409)

      assert %{
               "errors" => %{
                 "detail" => "Cannot delete playlist that is used in channels",
                 "channels" => channels
               }
             } = response

      # Verify channel information is in the response
      assert is_list(channels)
      assert length(channels) == 1
      [channel_info] = channels
      assert channel_info["name"] == channel.name
      assert channel_info["usage_type"] == "scheduled"
      assert channel_info["entry_start"] != nil
      assert channel_info["entry_end"] != nil
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

  describe "get playlist ancestors" do
    alias Castmill.Resources

    setup %{organization: _organization} do
      # Get or create the layout-widget widget for testing
      # The system may or may not have it, so we ensure it exists
      layout_widget =
        case Castmill.Repo.get_by(Castmill.Widgets.Widget, slug: "layout-widget") do
          nil ->
            Castmill.PlaylistsFixtures.widget_fixture(%{
              name: "Layout Widget",
              slug: "layout-widget",
              template: %{
                "type" => "layout",
                "name" => "layout-ref-widget",
                "opts" => %{"layoutRef" => %{"key" => "options.layoutRef"}}
              },
              options_schema: %{
                "layoutRef" => %{
                  "type" => "layout-ref",
                  "required" => true,
                  "description" => "Select a layout and assign playlists to each zone"
                }
              }
            })

          existing_widget ->
            existing_widget
        end

      {:ok, layout_widget: layout_widget}
    end

    test "returns empty ancestors for a standalone playlist", %{
      conn: conn,
      organization: organization,
      team: team
    } do
      playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "standalone_playlist"
        })

      {:ok, _result} = Teams.add_resource_to_team(team.id, "playlists", playlist.id, [:read])

      conn = get(conn, "/api/organizations/#{organization.id}/playlists/#{playlist.id}/ancestors")
      response = json_response(conn, 200)

      assert %{"ancestor_ids" => []} = response
    end

    test "returns parent playlist when child is referenced in layout widget", %{
      conn: conn,
      organization: organization,
      team: team,
      layout_widget: layout_widget
    } do
      # Create parent playlist (the one containing the layout widget)
      parent_playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "parent_playlist"
        })

      # Create child playlist (the one being referenced)
      child_playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "child_playlist"
        })

      # Add the layout widget to the parent playlist with reference to child
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          parent_playlist.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => child_playlist.id}}
            }
          }
        )

      {:ok, _result} =
        Teams.add_resource_to_team(team.id, "playlists", child_playlist.id, [:read])

      {:ok, _result} =
        Teams.add_resource_to_team(team.id, "playlists", parent_playlist.id, [:read])

      # Get ancestors of child playlist
      conn =
        get(
          conn,
          "/api/organizations/#{organization.id}/playlists/#{child_playlist.id}/ancestors"
        )

      response = json_response(conn, 200)

      assert %{"ancestor_ids" => ancestor_ids} = response
      assert parent_playlist.id in ancestor_ids
      assert length(ancestor_ids) == 1
    end

    test "returns multiple ancestors in a chain (grandparent -> parent -> child)", %{
      conn: conn,
      organization: organization,
      team: team,
      layout_widget: layout_widget
    } do
      # Create grandparent playlist
      grandparent_playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "grandparent_playlist"
        })

      # Create parent playlist
      parent_playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "parent_playlist"
        })

      # Create child playlist
      child_playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "child_playlist"
        })

      # Create link: grandparent -> parent
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          grandparent_playlist.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => parent_playlist.id}}
            }
          }
        )

      # Create link: parent -> child
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          parent_playlist.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => child_playlist.id}}
            }
          }
        )

      {:ok, _result} =
        Teams.add_resource_to_team(team.id, "playlists", child_playlist.id, [:read])

      # Get ancestors of child playlist - should include both parent and grandparent
      conn =
        get(
          conn,
          "/api/organizations/#{organization.id}/playlists/#{child_playlist.id}/ancestors"
        )

      response = json_response(conn, 200)

      assert %{"ancestor_ids" => ancestor_ids} = response
      assert parent_playlist.id in ancestor_ids
      assert grandparent_playlist.id in ancestor_ids
      assert length(ancestor_ids) == 2
    end

    test "returns multiple direct parents when playlist is referenced in multiple playlists", %{
      conn: conn,
      organization: organization,
      team: team,
      layout_widget: layout_widget
    } do
      # Create two parent playlists
      parent1 =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "parent1"
        })

      parent2 =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "parent2"
        })

      # Create child playlist
      child_playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "child_playlist"
        })

      # Parent1 references child
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          parent1.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => child_playlist.id}}
            }
          }
        )

      # Parent2 references child
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          parent2.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => child_playlist.id}}
            }
          }
        )

      {:ok, _result} =
        Teams.add_resource_to_team(team.id, "playlists", child_playlist.id, [:read])

      conn =
        get(
          conn,
          "/api/organizations/#{organization.id}/playlists/#{child_playlist.id}/ancestors"
        )

      response = json_response(conn, 200)

      assert %{"ancestor_ids" => ancestor_ids} = response
      assert parent1.id in ancestor_ids
      assert parent2.id in ancestor_ids
      assert length(ancestor_ids) == 2
    end

    test "handles playlist referenced in multiple slots of same layout widget", %{
      conn: conn,
      organization: organization,
      team: team,
      layout_widget: layout_widget
    } do
      parent_playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "parent_playlist"
        })

      child_playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "child_playlist"
        })

      # Reference child in multiple zones
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          parent_playlist.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{
                "zone-1" => %{"playlistId" => child_playlist.id},
                "zone-2" => %{"playlistId" => child_playlist.id},
                "zone-3" => %{"playlistId" => child_playlist.id}
              }
            }
          }
        )

      {:ok, _result} =
        Teams.add_resource_to_team(team.id, "playlists", child_playlist.id, [:read])

      conn =
        get(
          conn,
          "/api/organizations/#{organization.id}/playlists/#{child_playlist.id}/ancestors"
        )

      response = json_response(conn, 200)

      assert %{"ancestor_ids" => ancestor_ids} = response
      # Should only return the parent once, not duplicated
      assert parent_playlist.id in ancestor_ids
      assert length(ancestor_ids) == 1
    end

    test "does not include non-layout widget references", %{
      conn: conn,
      organization: organization,
      team: team
    } do
      # Create a non-layout widget (e.g., a regular widget)
      regular_widget =
        Castmill.PlaylistsFixtures.widget_fixture(%{
          name: "Regular Widget Test",
          slug: "regular-widget-test",
          template: %{"type" => "simple"},
          options_schema: %{"playlist_1" => %{"type" => "ref", "collection" => "playlists"}}
        })

      parent_playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "parent_playlist"
        })

      child_playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "child_playlist"
        })

      # Create widget config with some reference (but not a layout widget)
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          parent_playlist.id,
          nil,
          regular_widget.id,
          0,
          10000,
          %{"playlist_1" => child_playlist.id}
        )

      {:ok, _result} =
        Teams.add_resource_to_team(team.id, "playlists", child_playlist.id, [:read])

      conn =
        get(
          conn,
          "/api/organizations/#{organization.id}/playlists/#{child_playlist.id}/ancestors"
        )

      response = json_response(conn, 200)

      # Should be empty because the widget is not a layout widget
      assert %{"ancestor_ids" => []} = response
    end

    test "returns empty ancestors for non-existent playlist", %{
      conn: conn,
      organization: organization
    } do
      conn = get(conn, "/api/organizations/#{organization.id}/playlists/999999/ancestors")

      # The endpoint returns 200 with empty array for non-existent playlist
      # (since get_playlist_ancestors just returns empty for playlists with no parents)
      response = json_response(conn, 200)
      assert %{"ancestor_ids" => []} = response
    end

    test "handles diamond dependency (A->B, A->C, B->D, C->D)", %{
      conn: conn,
      organization: organization,
      team: team,
      layout_widget: layout_widget
    } do
      # Create diamond structure:
      #     A (top)
      #    / \
      #   B   C
      #    \ /
      #     D (bottom)

      playlist_a = playlist_fixture(%{organization_id: organization.id, name: "A"})
      playlist_b = playlist_fixture(%{organization_id: organization.id, name: "B"})
      playlist_c = playlist_fixture(%{organization_id: organization.id, name: "C"})
      playlist_d = playlist_fixture(%{organization_id: organization.id, name: "D"})

      # A references B and C
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          playlist_a.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{
                "zone-1" => %{"playlistId" => playlist_b.id},
                "zone-2" => %{"playlistId" => playlist_c.id}
              }
            }
          }
        )

      # B references D
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          playlist_b.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => playlist_d.id}}
            }
          }
        )

      # C references D
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          playlist_c.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => playlist_d.id}}
            }
          }
        )

      {:ok, _result} = Teams.add_resource_to_team(team.id, "playlists", playlist_d.id, [:read])

      # Ancestors of D should include B, C, and A (all unique)
      conn =
        get(conn, "/api/organizations/#{organization.id}/playlists/#{playlist_d.id}/ancestors")

      response = json_response(conn, 200)

      assert %{"ancestor_ids" => ancestor_ids} = response
      assert playlist_a.id in ancestor_ids
      assert playlist_b.id in ancestor_ids
      assert playlist_c.id in ancestor_ids
      # Should have exactly 3 ancestors, no duplicates
      assert length(ancestor_ids) == 3
    end

    test "server-side validation prevents cyclic structures from being created", %{
      organization: organization,
      layout_widget: layout_widget
    } do
      # This test verifies that cycles cannot be created due to server-side validation
      # The algorithm for get_playlist_ancestors still handles cycles gracefully (visited set)
      # but they should never occur in practice thanks to atomic validation

      playlist_a = playlist_fixture(%{organization_id: organization.id, name: "A_cycle"})
      playlist_b = playlist_fixture(%{organization_id: organization.id, name: "B_cycle"})

      # A references B (should succeed)
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          playlist_a.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => playlist_b.id}}
            }
          }
        )

      # B references A (should fail - would create a cycle)
      result =
        Resources.insert_item_into_playlist(
          playlist_b.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => playlist_a.id}}
            }
          }
        )

      # Server-side validation should prevent the cycle
      assert {:error, :circular_reference} = result
    end

    test "prevents self-referencing playlist", %{
      organization: organization,
      layout_widget: layout_widget
    } do
      playlist = playlist_fixture(%{organization_id: organization.id, name: "self_ref_test"})

      # Try to add a layout widget that references itself
      result =
        Resources.insert_item_into_playlist(
          playlist.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => playlist.id}}
            }
          }
        )

      assert {:error, :circular_reference} = result
    end

    test "prevents direct circular reference (A -> B -> A)", %{
      organization: organization,
      layout_widget: layout_widget
    } do
      playlist_a = playlist_fixture(%{organization_id: organization.id, name: "A"})
      playlist_b = playlist_fixture(%{organization_id: organization.id, name: "B"})

      # A -> B (this should succeed)
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          playlist_a.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => playlist_b.id}}
            }
          }
        )

      # B -> A (this should fail - would create cycle)
      result =
        Resources.insert_item_into_playlist(
          playlist_b.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => playlist_a.id}}
            }
          }
        )

      assert {:error, :circular_reference} = result
    end

    test "prevents indirect circular reference (A -> B -> C -> A)", %{
      organization: organization,
      layout_widget: layout_widget
    } do
      playlist_a = playlist_fixture(%{organization_id: organization.id, name: "A"})
      playlist_b = playlist_fixture(%{organization_id: organization.id, name: "B"})
      playlist_c = playlist_fixture(%{organization_id: organization.id, name: "C"})

      # A -> B (success)
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          playlist_a.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => playlist_b.id}}
            }
          }
        )

      # B -> C (success)
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          playlist_b.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => playlist_c.id}}
            }
          }
        )

      # C -> A (this should fail - would create cycle)
      result =
        Resources.insert_item_into_playlist(
          playlist_c.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => playlist_a.id}}
            }
          }
        )

      assert {:error, :circular_reference} = result
    end

    test "allows valid non-circular references", %{
      organization: organization,
      layout_widget: layout_widget
    } do
      # Create a tree structure: A -> B, A -> C, B -> D, C -> D
      # This is NOT circular, just D has multiple parents
      playlist_a = playlist_fixture(%{organization_id: organization.id, name: "A"})
      playlist_b = playlist_fixture(%{organization_id: organization.id, name: "B"})
      playlist_c = playlist_fixture(%{organization_id: organization.id, name: "C"})
      playlist_d = playlist_fixture(%{organization_id: organization.id, name: "D"})

      # A -> B, C
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          playlist_a.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{
                "zone-1" => %{"playlistId" => playlist_b.id},
                "zone-2" => %{"playlistId" => playlist_c.id}
              }
            }
          }
        )

      # B -> D
      {:ok, _item} =
        Resources.insert_item_into_playlist(
          playlist_b.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => playlist_d.id}}
            }
          }
        )

      # C -> D (this should succeed - D is a shared child, not a cycle)
      result =
        Resources.insert_item_into_playlist(
          playlist_c.id,
          nil,
          layout_widget.id,
          0,
          10000,
          %{
            "layoutRef" => %{
              "layoutId" => 1,
              "aspectRatio" => "9:16",
              "zonePlaylistMap" => %{"zone-1" => %{"playlistId" => playlist_d.id}}
            }
          }
        )

      assert {:ok, _item} = result
    end
  end

  describe "widget integration credentials validation" do
    alias Castmill.Widgets
    alias Castmill.Widgets.Integrations
    alias Castmill.Resources

    setup %{organization: organization, team: team} do
      # Create a widget with integration that requires credentials
      {:ok, widget_with_integration} =
        Widgets.create_widget(%{
          name: "Spotify Test Widget #{System.unique_integer([:positive])}",
          slug: "spotify-test-#{System.unique_integer([:positive])}",
          template: %{"html" => "<div>Spotify Test</div>"}
        })

      # Create an integration with credential_schema that requires auth
      {:ok, integration} =
        Integrations.create_integration(%{
          widget_id: widget_with_integration.id,
          name: "spotify",
          description: "Spotify integration for testing",
          integration_type: "pull",
          credential_scope: "organization",
          pull_endpoint: "https://api.spotify.com/v1/me/player",
          pull_interval_seconds: 15,
          credential_schema: %{
            "auth_type" => "oauth2",
            "fields" => %{
              "client_id" => %{"type" => "string", "required" => true},
              "client_secret" => %{"type" => "string", "required" => true}
            }
          }
        })

      # Create a playlist to test with
      playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "test_playlist_#{System.unique_integer([:positive])}"
        })

      {:ok, _result} =
        Teams.add_resource_to_team(team.id, "playlists", playlist.id, [:read, :write])

      %{
        widget_with_integration: widget_with_integration,
        integration: integration,
        playlist: playlist
      }
    end

    test "prevents adding widget to playlist when integration credentials are not configured", %{
      playlist: playlist,
      widget_with_integration: widget
    } do
      # Try to add widget without credentials configured
      result =
        Resources.insert_item_into_playlist(
          playlist.id,
          nil,
          widget.id,
          0,
          10000,
          %{}
        )

      assert {:error, :missing_integration_credentials} = result
    end

    test "allows adding widget to playlist when integration credentials are configured", %{
      organization: organization,
      playlist: playlist,
      widget_with_integration: widget,
      integration: integration
    } do
      # Store credentials for this organization
      {:ok, _credential} =
        Integrations.upsert_credentials(%{
          widget_integration_id: integration.id,
          organization_id: organization.id,
          encrypted_credentials: "test_encrypted_data"
        })

      # Now adding widget should succeed
      result =
        Resources.insert_item_into_playlist(
          playlist.id,
          nil,
          widget.id,
          0,
          10000,
          %{}
        )

      assert {:ok, _item} = result
    end

    test "allows adding regular widget without integrations to playlist", %{
      organization: organization,
      team: team
    } do
      # Create a simple widget without any integrations
      {:ok, simple_widget} =
        Widgets.create_widget(%{
          name: "Simple Widget #{System.unique_integer([:positive])}",
          slug: "simple-#{System.unique_integer([:positive])}",
          template: %{"html" => "<div>Simple</div>"}
        })

      # Create a new playlist
      playlist =
        playlist_fixture(%{
          organization_id: organization.id,
          name: "simple_test_playlist_#{System.unique_integer([:positive])}"
        })

      {:ok, _result} =
        Teams.add_resource_to_team(team.id, "playlists", playlist.id, [:read, :write])

      # Adding widget without integrations should succeed
      result =
        Resources.insert_item_into_playlist(
          playlist.id,
          nil,
          simple_widget.id,
          0,
          10000,
          %{}
        )

      assert {:ok, _item} = result
    end
  end
end
