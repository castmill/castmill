defmodule CastmillWeb.OrganizationUsageControllerTest do
  use CastmillWeb.ConnCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.AccountsFixtures
  import Castmill.MediasFixtures
  import Castmill.FilesFixtures
  import Castmill.TeamsFixtures

  alias Castmill.Quotas

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    # Create access token for authentication
    access_token =
      access_token_fixture(%{secret: "testuser:testpass", user_id: user.id, is_root: true})

    # Set up a plan with quotas for the organization
    plan =
      Quotas.create_plan("Test Plan", network.id, [
        %{max: 100, resource: :medias},
        %{max: 50, resource: :playlists},
        %{max: 20, resource: :devices},
        %{max: 10, resource: :channels},
        %{max: 5, resource: :teams},
        %{max: 10, resource: :users},
        # Storage quota in MB (100 MB)
        %{max: 100, resource: :storage},
        # Max upload size in MB (2 GB)
        %{max: 2048, resource: :max_upload_size}
      ])

    Quotas.assign_plan_to_organization(plan.id, organization.id)

    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> put_req_header("authorization", "Bearer #{access_token.secret}")

    {:ok, conn: conn, organization: organization, network: network, user: user}
  end

  describe "index" do
    test "reports automations, rules, tags, tag groups and agents; agents are not users", %{
      conn: conn,
      organization: organization
    } do
      for {resource, max} <- [
            automations: 4,
            automation_rules: 10,
            tags: 20,
            tag_groups: 5,
            agents: 3
          ],
          do: Quotas.add_quota_to_organization(organization.id, resource, max)

      users_before =
        json_response(get(conn, "/dashboard/organizations/#{organization.id}/usage"), 200)[
          "users"
        ]["used"]

      playlist =
        Castmill.PlaylistsFixtures.playlist_fixture(%{organization_id: organization.id})

      rule = %{
        "when" => %{
          "source" => "clock",
          "condition" => "at",
          "config" => %{"schedule" => %{"type" => "hourly", "minute" => 8}}
        },
        "then" => %{"action" => "interrupt", "config" => %{"playlist_id" => playlist.id}}
      }

      {:ok, _} =
        Castmill.Automations.create_automation(organization.id, %{
          "name" => "Spring",
          "rules" => [rule, rule]
        })

      {:ok, group} =
        Castmill.Tags.create_tag_group(%{name: "Location", organization_id: organization.id})

      for name <- ["North", "South"],
          do:
            {:ok, _} =
              Castmill.Tags.create_tag(%{
                name: name,
                organization_id: organization.id,
                tag_group_id: group.id
              })

      {:ok, _agent, _secret} = Castmill.Agents.create_agent(organization.id, %{name: "Bot"})

      response =
        json_response(get(conn, "/dashboard/organizations/#{organization.id}/usage"), 200)

      assert response["automations"] == %{"used" => 1, "total" => 4}
      assert response["automation_rules"] == %{"used" => 2, "total" => 10}
      assert response["tags"] == %{"used" => 2, "total" => 20}
      assert response["tag_groups"] == %{"used" => 1, "total" => 5}
      assert response["agents"] == %{"used" => 1, "total" => 3}
      assert response["users"]["used"] == users_before
    end

    test "returns usage data for all resources in an organization", %{
      conn: conn,
      organization: organization,
      network: network
    } do
      # Add some users to the organization (use unique emails to avoid conflicts)
      unique_id = System.unique_integer([:positive])

      user1 =
        user_fixture(%{
          email: "user1_#{unique_id}@test.com",
          name: "User1 #{unique_id}",
          network_id: network.id
        })

      user2 =
        user_fixture(%{
          email: "user2_#{unique_id}@test.com",
          name: "User2 #{unique_id}",
          network_id: network.id
        })

      Castmill.Repo.insert!(%Castmill.Organizations.OrganizationsUsers{
        organization_id: organization.id,
        user_id: user1.id,
        role: :member
      })

      Castmill.Repo.insert!(%Castmill.Organizations.OrganizationsUsers{
        organization_id: organization.id,
        user_id: user2.id,
        role: :admin
      })

      # Add some teams
      team_fixture(%{name: "Team 1", organization_id: organization.id})
      team_fixture(%{name: "Team 2", organization_id: organization.id})

      # Add some media with files for storage
      media1 =
        media_fixture(%{
          name: "test media 1",
          organization_id: organization.id,
          mimetype: "image/png"
        })

      {:ok, file1} =
        file_fixture(%{
          name: "file1.png",
          organization_id: organization.id,
          size: 1024 * 1024,
          mimetype: "image/png",
          uri: "s3://bucket/file1.png"
        })

      Castmill.Repo.insert!(%Castmill.Files.FilesMedias{
        file_id: file1.id,
        media_id: media1.id,
        context: "default"
      })

      conn = get(conn, "/dashboard/organizations/#{organization.id}/usage")

      response = json_response(conn, 200)

      # Verify the response structure
      assert response["medias"]["used"] == 1
      assert response["medias"]["total"] == 100

      assert response["teams"]["used"] == 2
      assert response["teams"]["total"] == 5

      assert response["users"]["used"] == 2
      assert response["users"]["total"] == 10

      assert response["storage"]["used"] == 1024 * 1024
      # Storage quota stored in MB, controller converts to bytes for display
      assert response["storage"]["total"] == 100 * 1024 * 1024

      # Resources with no usage
      assert response["playlists"]["used"] == 0
      assert response["playlists"]["total"] == 50

      assert response["devices"]["used"] == 0
      assert response["devices"]["total"] == 20

      assert response["channels"]["used"] == 0
      assert response["channels"]["total"] == 10

      assert response["widgets"]["used"] == 0
      assert response["widgets"]["total"] == 0
    end

    test "returns empty usage when organization has no data", %{
      conn: conn,
      organization: organization
    } do
      conn = get(conn, "/dashboard/organizations/#{organization.id}/usage")

      response = json_response(conn, 200)

      # All resources should have 0 usage but defined totals from the plan
      assert response["medias"]["used"] == 0
      assert response["medias"]["total"] == 100

      assert response["users"]["used"] == 0
      assert response["users"]["total"] == 10

      assert response["storage"]["used"] == 0
      # Storage quota stored in MB, controller converts to bytes for display
      assert response["storage"]["total"] == 100 * 1024 * 1024

      assert response["widgets"]["used"] == 0
      assert response["widgets"]["total"] == 0
    end
  end
end
