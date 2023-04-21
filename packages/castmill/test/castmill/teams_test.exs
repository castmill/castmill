defmodule Castmill.TeamsTest do
  use Castmill.DataCase

  @moduletag :teams_data_case

  alias Castmill.Teams

  describe "teams" do
    alias Castmill.Accounts.AccessToken

    import Castmill.NetworksFixtures
    import Castmill.OrganizationsFixtures
    import Castmill.PlaylistsFixtures
    import Castmill.TeamsFixtures
    import Castmill.MediasFixtures

    @invalid_attrs %{accessed: nil, accessed_at: nil, last_ip: nil}

    test "list_teams/1 returns all teams" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      team = team_fixture(%{organization_id: organization.id})

      assert Teams.list_teams(organization.id) == [team]

      {:ok, team2} = Teams.create_team(%{name: "Team 2", organization_id: organization.id})

      # TODO: order may be random, so we should sort by name
      assert Teams.list_teams(organization.id) == [team2, team]
    end

    test "add_user_to_team/2 adds user to team" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      team = team_fixture(%{organization_id: organization.id})
      user = user_fixture(%{organization_id: organization.id})

      lean_user = %{id: user.id, name: user.name, email: user.email, avatar: user.avatar}

      {:ok, result} = Teams.add_user_to_team(team.id, user.id, :member)

      users = Teams.list_users(team.id)

      assert users == [Map.merge(lean_user, %{role: :member})]

      assert Teams.list_teams(organization.id) == [team]

      {:ok, team2} = Teams.create_team(%{name: "Team 2", organization_id: organization.id})

      # TODO: order may be random, so we should sort by name
      assert Teams.list_teams(organization.id) == [team2, team]
    end

    test "add_user_to_team/2 adds admins to a team" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      team = team_fixture(%{organization_id: organization.id})
      user = user_fixture(%{organization_id: organization.id})

      lean_user = %{id: user.id, name: user.name, email: user.email, avatar: user.avatar}

      {:ok, result} = Teams.add_user_to_team(team.id, user.id, :admin)

      users = Teams.list_users(team.id)

      assert users == [Map.merge(lean_user, %{role: :admin})]

      assert Teams.list_teams(organization.id) == [team]

      {:ok, team2} = Teams.create_team(%{name: "Team 2", organization_id: organization.id})

      # TODO: order may be random, so we should sort by name
      assert Teams.list_teams(organization.id) == [team2, team]
    end

    test "add_resource_to_team/2 adds resources to a team with given access" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      team = team_fixture(%{organization_id: organization.id})
      media = media_fixture(%{organization_id: organization.id})

      {:ok, result} = Teams.add_resource_to_team(team.id, media.id, :media, [:read, :write])
      {:ok, result} = Teams.add_resource_to_team(team.id, playlist.id, :playlist, [:read, :write])

      resources = Teams.list_resources(team.id)

      organizationId = organization.id
      mediaId = media.id

      assert [%{access: [:read, :write],
      resource: %{
        type: :media,
        media: %{
          :id => mediaId,
          mimetype: "video/mp4",
          name: "Hangar 42",
          size: 123,
          uri: "https://some.url.com",
         organization_id: organizationId,
        }
      }
      },
      %{access: [:read, :write],
      resource: %{
        type: :playlist,
        playlist: %{
          :id => playlistId,
          name: "Hangar 42",
          organization_id: organizationId,
        }
      }
      }
      ] = resources
    end

    test "remove_user_from_team/2 removes user from team" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      team = team_fixture(%{organization_id: organization.id})
      user = user_fixture(%{organization_id: organization.id})

      lean_user = %{id: user.id, name: user.name, email: user.email, avatar: user.avatar}

      {:ok, result} = Teams.add_user_to_team(team.id, user.id, :member)

      users = Teams.list_users(team.id)

      assert users == [Map.merge(lean_user, %{role: :member})]

      assert Teams.list_teams(organization.id) == [team]

      {:ok, team2} = Teams.create_team(%{name: "Team 2", organization_id: organization.id})

      # TODO: order may be random, so we should sort by name
      assert Teams.list_teams(organization.id) == [team2, team]

      {1, nil} = Teams.remove_user_from_team(team.id, user.id)

      assert Teams.list_users(team.id) == []
    end

    test "remove_resource_from_team/2 removes resource from a team" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      team = team_fixture(%{organization_id: organization.id})
      media = media_fixture(%{organization_id: organization.id})

      {:ok, result} = Teams.add_resource_to_team(team.id, media.id, :media, [:read, :write])
      {:ok, result} = Teams.add_resource_to_team(team.id, playlist.id, :playlist, [:read, :write])

      resources = Teams.list_resources(team.id)

      organizationId = organization.id
      mediaId = media.id

      assert [%{access: [:read, :write],
      resource: %{
        type: :media,
        media: %{
          :id => mediaId,
          mimetype: "video/mp4",
          name: "Hangar 42",
          size: 123,
          uri: "https://some.url.com",
         organization_id: organizationId,
        }
      }
      },
      %{access: [:read, :write],
      resource: %{
        type: :playlist,
        playlist: %{
          :id => playlistId,
          name: "Hangar 42",
          organization_id: organizationId,
        }
      }
      }
      ] = resources

      [resource|rest] = resources

      {1, nil} = Teams.remove_resource_from_team(resource.team_id, resource.resource.id)

      assert Teams.list_resources(resource.team_id) == rest
    end

  end
end
