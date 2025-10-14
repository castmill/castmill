defmodule Castmill.TeamsTest do
  use Castmill.DataCase

  alias Castmill.Teams
  alias Ecto.UUID

  @moduletag :teams_data_case
  @moduletag :teams

  describe "teams" do
    import Castmill.NetworksFixtures
    import Castmill.OrganizationsFixtures
    import Castmill.PlaylistsFixtures
    import Castmill.TeamsFixtures
    import Castmill.MediasFixtures

    test "list_teams/1 returns all teams" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      team = team_fixture(%{organization_id: organization.id})

      assert Teams.list_teams(organization.id) == [team]

      {:ok, team2} = Teams.create_team(%{name: "Team 2", organization_id: organization.id})

      # TODO: order may be random, so we should sort by name
      assert Teams.list_teams(organization.id) == [team2, team]
    end

    test "create_team/2 assigns the creator as admin" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      creator = user_fixture(%{organization_id: organization.id})
      creator_id = creator.id

      assert {:ok, team} =
               Teams.create_team(%{name: "Ops", organization_id: organization.id}, creator)

      assert [%{role: :admin, user: %{id: ^creator_id}}] =
               Teams.list_users(%{team_id: team.id, page_size: 10})
    end

    test "create_team/2 rolls back when membership fails" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      non_existing_user_id = UUID.generate()

      assert {:error, changeset} =
               Teams.create_team(
                 %{name: "Ops", organization_id: organization.id},
                 non_existing_user_id
               )

      assert %Ecto.Changeset{} = changeset
      assert Teams.list_teams(organization.id) == []
    end

    test "add_user_to_team/2 adds user to team" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      team = team_fixture(%{organization_id: organization.id})
      user = user_fixture(%{organization_id: organization.id})
      user_id = user.id
      user_name = user.name
      user_email = user.email
      user_avatar = user.avatar

      {:ok, _result} = Teams.add_user_to_team(team.id, user.id, :member)

      users = Teams.list_users(%{team_id: team.id})

      assert [
               %{
                 user_id: ^user_id,
                 role: :member,
                 inserted_at: inserted_at,
                 user: %{
                   id: ^user_id,
                   name: ^user_name,
                   email: ^user_email,
                   avatar: ^user_avatar
                 }
               }
             ] = users

      assert inserted_at.__struct__ in [NaiveDateTime, DateTime]

      assert Teams.list_teams(organization.id) == [team]

      {:ok, team2} = Teams.create_team(%{name: "Team 2", organization_id: organization.id})

      # TODO: order may be random, so we should sort by name
      assert Teams.list_teams(organization.id) == [team2, team]
    end

    test "add_user_to_team/2 adds admins to a team" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      team = team_fixture(%{organization_id: organization.id})
      user = user_fixture(%{organization_id: organization.id})
      user_id = user.id
      user_name = user.name
      user_email = user.email
      user_avatar = user.avatar

      {:ok, _result} = Teams.add_user_to_team(team.id, user.id, :admin)

      users = Teams.list_users(%{team_id: team.id})

      assert [
               %{
                 user_id: ^user_id,
                 role: :admin,
                 inserted_at: inserted_at,
                 user: %{
                   id: ^user_id,
                   name: ^user_name,
                   email: ^user_email,
                   avatar: ^user_avatar
                 }
               }
             ] = users

      assert inserted_at.__struct__ in [NaiveDateTime, DateTime]

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

      {:ok, _result} = Teams.add_resource_to_team(team.id, "medias", media.id, [:read, :write])

      {:ok, _result} =
        Teams.add_resource_to_team(team.id, "playlists", playlist.id, [:read, :write])

      medias = Teams.list_resources("medias", %{team_id: team.id})

      media_id = media.id
      playlist_id = playlist.id
      organization_id = organization.id

      assert [
               %Castmill.Teams.TeamsMedias{
                 access: [:read, :write],
                 media: %Castmill.Resources.Media{
                   id: ^media_id,
                   name: "Hangar 42",
                   mimetype: "video/mp4",
                   organization_id: ^organization_id
                 }
               }
             ] = medias

      playlists = Teams.list_resources("playlists", %{team_id: team.id})

      assert [
               %Castmill.Teams.TeamsPlaylists{
                 access: [:read, :write],
                 playlist: %Castmill.Resources.Playlist{
                   :id => ^playlist_id,
                   name: "Hangar 42",
                   organization_id: ^organization_id
                 }
               }
             ] = playlists
    end

    test "remove_user_from_team/2 removes user from team" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      team = team_fixture(%{organization_id: organization.id})
      user = user_fixture(%{organization_id: organization.id})

      lean_user = %{id: user.id, name: user.name, email: user.email, avatar: user.avatar}

      {:ok, _result} = Teams.add_user_to_team(team.id, user.id, :member)

      users = Teams.list_users(%{team_id: team.id})

      assert [%{role: :member, user: ^lean_user}] = users

      assert Teams.list_teams(organization.id) == [team]

      {:ok, team2} = Teams.create_team(%{name: "Team 2", organization_id: organization.id})

      # TODO: order may be random, so we should sort by name
      assert Teams.list_teams(organization.id) == [team2, team]

      {:ok, _} = Teams.remove_user_from_team(team.id, user.id)

      assert Teams.list_users(%{team_id: team.id}) == []
    end

    test "remove_user_from_team/2 prevents removing the last admin" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      team = team_fixture(%{organization_id: organization.id})
      admin = user_fixture(%{organization_id: organization.id})

      {:ok, _} = Teams.add_user_to_team(team.id, admin.id, :admin)

      assert {:error, :last_admin} = Teams.remove_user_from_team(team.id, admin.id)

      assert [%{role: :admin}] = Teams.list_users(%{team_id: team.id})
    end

    test "remove_user_from_team/2 allows removing an admin when others remain" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      team = team_fixture(%{organization_id: organization.id})
      admin_one = user_fixture(%{organization_id: organization.id})
      admin_two = user_fixture(%{organization_id: organization.id})

      {:ok, _} = Teams.add_user_to_team(team.id, admin_one.id, :admin)
      {:ok, _} = Teams.add_user_to_team(team.id, admin_two.id, :admin)

      assert {:ok, _} = Teams.remove_user_from_team(team.id, admin_one.id)

      remaining_roles = Teams.list_users(%{team_id: team.id}) |> Enum.map(& &1.role)
      assert [:admin] = remaining_roles
    end

    test "remove_resource_from_team/2 removes resource from a team" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      team = team_fixture(%{organization_id: organization.id})
      media = media_fixture(%{organization_id: organization.id})

      {:ok, _result} = Teams.add_resource_to_team(team.id, "medias", media.id, [:read, :write])

      {:ok, _result} =
        Teams.add_resource_to_team(team.id, "playlists", playlist.id, [:read, :write])

      resources = Teams.list_resources("medias", %{team_id: team.id})

      organizationId = organization.id
      mediaId = media.id

      assert [
               %{
                 access: [:read, :write],
                 media: %{
                   :id => ^mediaId,
                   mimetype: "video/mp4",
                   name: "Hangar 42",
                   organization_id: ^organizationId
                 }
               }
             ] = resources

      [resource | rest] = resources

      {:ok, _} = Teams.remove_resource_from_team(resource.team_id, "medias", resource.media.id)

      assert Teams.list_resources("medias", %{team_id: resource.team_id}) == rest
    end

    test "has_access_to_resource/3 (user_id, resource_id, access) checks if a user has access to a resource based on the team" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      playlist = playlist_fixture(%{organization_id: organization.id})
      team = team_fixture(%{organization_id: organization.id})
      user = user_fixture(%{organization_id: organization.id})

      {:ok, _result} = Teams.add_user_to_team(team.id, user.id, :member)

      assert Teams.has_access_to_resource(user.id, "playlists", playlist.id, :read) == false

      {:ok, _team_resource} =
        Teams.add_resource_to_team(team.id, "playlists", playlist.id, [:read])

      assert Teams.has_access_to_resource(user.id, "playlists", playlist.id, :read) ==
               true

      assert Teams.has_access_to_resource(user.id, "playlists", playlist.id, :write) ==
               false

      Teams.update_resource_access(team.id, "playlists", playlist.id, [:write, :delete])

      assert Teams.has_access_to_resource(user.id, "playlists", playlist.id, :write) ==
               true

      assert Teams.has_access_to_resource(
               user.id,
               "playlists",
               playlist.id,
               :delete
             ) == true

      assert Teams.has_access_to_resource(user.id, "playlists", playlist.id, :read) ==
               false
    end
  end
end
