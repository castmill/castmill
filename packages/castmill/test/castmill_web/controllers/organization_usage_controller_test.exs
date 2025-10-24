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

    # Set up a plan with quotas for the organization
    plan =
      Quotas.create_plan("Test Plan", network.id, [
        %{max: 100, resource: :medias},
        %{max: 50, resource: :playlists},
        %{max: 20, resource: :devices},
        %{max: 10, resource: :channels},
        %{max: 5, resource: :teams},
        %{max: 10, resource: :users},
        %{max: 1024 * 1024 * 100, resource: :storage}
      ])

    Quotas.assign_plan_to_organization(plan.id, organization.id)

    {:ok,
     conn: put_req_header(conn, "accept", "application/json"),
     organization: organization,
     network: network}
  end

  describe "index" do
    test "returns usage data for all resources in an organization", %{
      conn: conn,
      organization: organization,
      network: network
    } do
      # Add some users to the organization
      user1 = user_fixture(%{email: "user1@test.com", network_id: network.id})
      user2 = user_fixture(%{email: "user2@test.com", network_id: network.id})

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
      assert response["storage"]["total"] == 1024 * 1024 * 100

      # Resources with no usage
      assert response["playlists"]["used"] == 0
      assert response["playlists"]["total"] == 50

      assert response["devices"]["used"] == 0
      assert response["devices"]["total"] == 20

      assert response["channels"]["used"] == 0
      assert response["channels"]["total"] == 10
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
      assert response["storage"]["total"] == 1024 * 1024 * 100
    end
  end
end
