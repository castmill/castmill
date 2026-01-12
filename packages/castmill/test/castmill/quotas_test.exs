defmodule Castmill.QuotasTest do
  use Castmill.DataCase

  @moduletag :quota_data_case

  alias Castmill.Quotas

  @moduletag :quotas

  describe "quotas" do
    @describetag :quotas

    import Castmill.NetworksFixtures
    import Castmill.OrganizationsFixtures

    test "create_plan/3 creates a plan for a given network" do
      network = network_fixture()

      # Network already has "Default Plan", so create a different one
      plan =
        Quotas.create_plan("test plan", network.id, [
          %{max: 10, resource: :medias},
          %{max: 5, resource: :organizations}
        ])

      assert plan.name == "test plan"

      network_plans = Quotas.list_plans(network.id)
      # Should have both Default Plan and test plan
      assert length(network_plans) == 2
      assert Enum.any?(network_plans, fn p -> p.name == "test plan" end)
      assert Enum.any?(network_plans, fn p -> p.name == "Default Plan" end)
    end

    test "assign_quota_to_network/2 assigns a quota to a given network" do
      network = network_fixture()

      assert Quotas.has_network_enough_quota?(network.id, :organizations, 5) == false

      Quotas.assign_quota_to_network(network.id, :organizations, 5)
      assert Quotas.has_network_enough_quota?(network.id, :organizations, 5) == true

      assert Quotas.has_network_enough_quota?(network.id, :organizations, 5) == true
      assert Quotas.has_network_enough_quota?(network.id, :organizations, 6) == false
      assert Quotas.has_network_enough_quota?(network.id, :users, 9) == false

      Quotas.assign_quota_to_network(network.id, :users, 10)
      assert Quotas.has_network_enough_quota?(network.id, :users, 9) == true
    end

    test "assign_plan_to_organization/2 assigns a plan to a given organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      plan =
        Quotas.create_plan("test plan", network.id, [
          %{max: 10, resource: :medias},
          %{max: 5, resource: :organizations}
        ])

      assert Quotas.assign_plan_to_organization(plan.id, organization.id)
      assert Quotas.has_organization_enough_quota?(organization.id, :organizations, 5) == true

      assert Quotas.has_network_enough_quota?(network.id, :organizations, 1) == false
      assert Quotas.has_organization_enough_quota?(organization.id, :medias, 9) == true
      assert Quotas.has_organization_enough_quota?(organization.id, :organizations, 4) == true
    end

    test "update_quota_for_network/3 updates a quota for a given network" do
      network = network_fixture()

      assert Quotas.has_network_enough_quota?(network.id, :organizations, 5) == false
      Quotas.update_quota_for_network(network.id, :organizations, 5)
      assert Quotas.has_network_enough_quota?(network.id, :organizations, 5) == false

      Quotas.add_quota_to_network(network.id, :organizations, 5)
      assert Quotas.has_network_enough_quota?(network.id, :organizations, 5) == true

      assert Quotas.has_network_enough_quota?(network.id, :organizations, 10) == false
      Quotas.update_quota_for_network(network.id, :organizations, 10)
      assert Quotas.has_network_enough_quota?(network.id, :organizations, 6) == true
      assert Quotas.has_network_enough_quota?(network.id, :organizations, 10) == true
    end

    test "add_quota_to_organization/3 overrides a quota for a given organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      plan =
        Quotas.create_plan("test plan", network.id, [
          %{max: 10, resource: :medias},
          %{max: 5, resource: :organizations}
        ])

      assert Quotas.assign_plan_to_organization(plan.id, organization.id)
      assert Quotas.has_organization_enough_quota?(organization.id, :medias, 10) == true
      assert Quotas.has_organization_enough_quota?(organization.id, :medias, 15) == false

      Quotas.add_quota_to_organization(organization.id, :medias, 15)
      assert Quotas.has_organization_enough_quota?(organization.id, :medias, 15) == true
    end

    test "list_plans/0 list plans" do
      network = network_fixture()

      # Network already has a "Default Plan", so create a different one
      _plan =
        Quotas.create_plan("test plan", network.id, [
          %{max: 10, resource: :medias},
          %{max: 5, resource: :organizations}
        ])

      # Should have both the default plan and the test plan
      all_plans = Quotas.list_plans()
      assert length(all_plans) == 2
      assert Enum.any?(all_plans, fn p -> p.name == "Default Plan" end)
      assert Enum.any?(all_plans, fn p -> p.name == "test plan" end)
    end

    test "delete_plan/1 deletes plan" do
      network = network_fixture()

      # Create a new plan (network already has Default Plan)
      plan =
        Quotas.create_plan("test plan", network.id, [
          %{max: 10, resource: :medias},
          %{max: 5, resource: :organizations}
        ])

      assert Quotas.delete_plan(plan.id)
      # Should only have the Default Plan left
      remaining_plans = Quotas.list_plans()
      assert length(remaining_plans) == 1
      assert List.first(remaining_plans).name == "Default Plan"
    end

    test "set_network_default_plan/2 sets the default plan for a network" do
      network = network_fixture()

      plan =
        Quotas.create_plan("Free Plan", network.id, [
          %{max: 100, resource: :medias},
          %{max: 10, resource: :teams}
        ])

      {:ok, updated_network} = Quotas.set_network_default_plan(network.id, plan.id)
      assert updated_network.default_plan_id == plan.id
    end

    test "get_quota_for_organization/2 falls back to network default plan when org has no plan" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      # Network already has a default plan from network_fixture
      # Just verify the organization gets quotas from it
      assert Castmill.Quotas.get_quota_for_organization(organization.id, "medias") == 1000
      assert Castmill.Quotas.get_quota_for_organization(organization.id, "teams") == 10
    end

    test "get_quota_for_organization/2 prioritizes org plan over network default plan" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      # Network already has a default plan from network_fixture
      # Create a DIFFERENT plan for the organization
      org_plan =
        Quotas.create_plan("Pro Plan", network.id, [
          %{max: 500, resource: :medias},
          %{max: 25, resource: :teams}
        ])

      Quotas.assign_plan_to_organization(org_plan.id, organization.id)

      # Organization should use its assigned plan, not the network default
      assert Quotas.get_quota_for_organization(organization.id, "medias") == 500
      assert Quotas.get_quota_for_organization(organization.id, "teams") == 25

      # For resources not in the org plan, should fall back to network default plan
      assert Quotas.get_quota_for_organization(organization.id, "storage") == 1_073_741_824
      assert Quotas.get_quota_for_organization(organization.id, "users") == 50
    end

    test "get_quota_for_organization/2 prioritizes org-specific quota over all plans" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      # Network already has a default plan from network_fixture
      # Create a specific plan for the organization
      org_plan =
        Quotas.create_plan("Pro Plan", network.id, [
          %{max: 500, resource: :medias}
        ])

      Quotas.assign_plan_to_organization(org_plan.id, organization.id)

      # Add organization-specific quota override
      Quotas.add_quota_to_organization(organization.id, :medias, 1000)

      # Organization should use its specific quota override
      assert Quotas.get_quota_for_organization(organization.id, "medias") == 1000
    end

    test "get_quota_for_organization/2 falls back to network quotas when no default plan" do
      # Create a network manually WITHOUT using the fixture (so no default plan is created)
      {:ok, network} =
        Castmill.Networks.Network.changeset(%Castmill.Networks.Network{}, %{
          name: "No Default Plan Network",
          email: "test@nodefault.com",
          domain: "nodefault.test.com"
        })
        |> Castmill.Repo.insert()

      organization = organization_fixture(%{network_id: network.id})

      # Set network-level quotas (no default plan)
      Quotas.assign_quota_to_network(network.id, :medias, 200)

      # Organization should fall back to network quotas
      assert Quotas.get_quota_for_organization(organization.id, "medias") == 200
    end

    test "get_quota_for_organization/2 returns 0 when no quotas are defined anywhere" do
      # Create a network manually WITHOUT using the fixture (so no default plan is created)
      {:ok, network} =
        Castmill.Networks.Network.changeset(%Castmill.Networks.Network{}, %{
          name: "Zero Quota Network",
          email: "test@zeroquota.com",
          domain: "zeroquota.test.com"
        })
        |> Castmill.Repo.insert()

      organization = organization_fixture(%{network_id: network.id})

      # No plans, no network quotas, no org quotas
      assert Quotas.get_quota_for_organization(organization.id, "medias") == 0
    end

    test "has_organization_enough_quota?/3 works with network default plan" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      # Network already has a default plan from network_fixture
      # Check quota availability through network default plan
      assert Quotas.has_organization_enough_quota?(organization.id, "medias", 50) == true
      assert Quotas.has_organization_enough_quota?(organization.id, "medias", 1000) == true
      assert Quotas.has_organization_enough_quota?(organization.id, "medias", 1001) == false
    end

    test "get_quota_for_organization/2 falls back when assigned plan lacks specific resource" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      # Create a plan with only medias quota (no storage or users)
      limited_plan =
        Quotas.create_plan("Limited Plan", network.id, [
          %{max: 100, resource: :medias}
        ])

      Quotas.assign_plan_to_organization(limited_plan.id, organization.id)

      # Organization should use its assigned plan for medias
      assert Quotas.get_quota_for_organization(organization.id, "medias") == 100

      # For storage and users (not in assigned plan), should fall back to network default plan
      assert Quotas.get_quota_for_organization(organization.id, "storage") == 1_073_741_824
      assert Quotas.get_quota_for_organization(organization.id, "users") == 50

      # Verify this allows uploads to work even with partial plan definitions
      assert Quotas.has_organization_enough_quota?(
               organization.id,
               "storage",
               1024 * 1024
             ) == true
    end

    test "team creation enforces quota from network default plan" do
      import Castmill.TeamsFixtures

      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      # Network default plan has teams quota of 10 (from migration)
      # Create 10 teams (should succeed)
      for i <- 1..10 do
        team = team_fixture(%{name: "Team #{i}", organization_id: organization.id})
        assert team.id != nil
      end

      # 11th team should fail due to quota
      {:error, :quota_exceeded} =
        Castmill.Teams.create_team(%{name: "Team 11", organization_id: organization.id})
    end

    test "team creation enforces quota from organization-specific quota" do
      import Castmill.TeamsFixtures

      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      # Override with organization-specific quota of 3 teams
      Quotas.add_quota_to_organization(organization.id, :teams, 3)

      # Create 3 teams (should succeed)
      for i <- 1..3 do
        team = team_fixture(%{name: "Team #{i}", organization_id: organization.id})
        assert team.id != nil
      end

      # 4th team should fail due to quota
      {:error, :quota_exceeded} =
        Castmill.Teams.create_team(%{name: "Team 4", organization_id: organization.id})
    end

    test "team creation enforces quota from assigned plan" do
      import Castmill.TeamsFixtures

      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      # Create a custom plan with lower teams quota
      plan =
        Quotas.create_plan("Small Plan", network.id, [
          %{max: 2, resource: :teams},
          %{max: 100, resource: :medias}
        ])

      # Assign the plan to the organization
      Quotas.assign_plan_to_organization(plan.id, organization.id)

      # Create 2 teams (should succeed)
      for i <- 1..2 do
        team = team_fixture(%{name: "Team #{i}", organization_id: organization.id})
        assert team.id != nil
      end

      # 3rd team should fail due to quota
      {:error, :quota_exceeded} =
        Castmill.Teams.create_team(%{name: "Team 3", organization_id: organization.id})
    end

    test "storage quota calculation sums file sizes across media files" do
      import Castmill.MediasFixtures
      import Castmill.FilesFixtures

      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      # Initially, storage should be 0
      assert Quotas.get_quota_used_for_organization(organization.id, :storage) == 0

      # Create media and associated files
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
          # 1 MB
          size: 1024 * 1024,
          mimetype: "image/png",
          uri: "s3://bucket/file1.png"
        })

      # Create files_medias association
      Castmill.Repo.insert!(%Castmill.Files.FilesMedias{
        file_id: file1.id,
        media_id: media1.id,
        context: "default"
      })

      # Storage should now be 1 MB
      assert Quotas.get_quota_used_for_organization(organization.id, :storage) == 1024 * 1024

      # Add another media with a larger file
      media2 =
        media_fixture(%{
          name: "test media 2",
          organization_id: organization.id,
          mimetype: "video/mp4"
        })

      {:ok, file2} =
        file_fixture(%{
          name: "file2.mp4",
          organization_id: organization.id,
          # 5 MB
          size: 5 * 1024 * 1024,
          mimetype: "video/mp4",
          uri: "s3://bucket/file2.mp4"
        })

      Castmill.Repo.insert!(%Castmill.Files.FilesMedias{
        file_id: file2.id,
        media_id: media2.id,
        context: "default"
      })

      # Storage should now be 6 MB total
      assert Quotas.get_quota_used_for_organization(organization.id, :storage) == 6 * 1024 * 1024

      # Test with another organization - should be isolated
      organization2 = organization_fixture(%{name: "Another Org", network_id: network.id})
      assert Quotas.get_quota_used_for_organization(organization2.id, :storage) == 0

      # Add file to organization2
      media3 =
        media_fixture(%{
          name: "test media 3",
          organization_id: organization2.id,
          mimetype: "image/jpeg"
        })

      {:ok, file3} =
        file_fixture(%{
          name: "file3.jpg",
          organization_id: organization2.id,
          # 2 MB
          size: 2 * 1024 * 1024,
          mimetype: "image/jpeg",
          uri: "s3://bucket/file3.jpg"
        })

      Castmill.Repo.insert!(%Castmill.Files.FilesMedias{
        file_id: file3.id,
        media_id: media3.id,
        context: "default"
      })

      # organization2 should have 2 MB, organization1 should still have 6 MB
      assert Quotas.get_quota_used_for_organization(organization2.id, :storage) == 2 * 1024 * 1024
      assert Quotas.get_quota_used_for_organization(organization.id, :storage) == 6 * 1024 * 1024
    end

    test "storage quota enforcement in has_organization_enough_quota?" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      # Create a plan with 10 MB storage quota
      plan =
        Quotas.create_plan("Storage Plan", network.id, [
          # 10 MB
          %{max: 10 * 1024 * 1024, resource: :storage}
        ])

      Quotas.assign_plan_to_organization(plan.id, organization.id)

      # Should have enough for 5 MB
      assert Quotas.has_organization_enough_quota?(organization.id, :storage, 5 * 1024 * 1024) ==
               true

      # Should have enough for exactly 10 MB
      assert Quotas.has_organization_enough_quota?(organization.id, :storage, 10 * 1024 * 1024) ==
               true

      # Should NOT have enough for 11 MB
      assert Quotas.has_organization_enough_quota?(organization.id, :storage, 11 * 1024 * 1024) ==
               false
    end

    test "users quota calculation counts organization members" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      # Initially, should have 0 users (organization creator not counted in this test)
      # Note: In practice, the organization creator is typically added as the first user
      assert Quotas.get_quota_used_for_organization(
               organization.id,
               Castmill.Organizations.OrganizationsUsers
             ) == 0

      # Add users to the organization (use unique emails to avoid conflicts)
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

      user3 =
        user_fixture(%{
          email: "user3_#{unique_id}@test.com",
          name: "User3 #{unique_id}",
          network_id: network.id
        })

      # Associate users with organization
      Castmill.Repo.insert!(%Castmill.Organizations.OrganizationsUsers{
        organization_id: organization.id,
        user_id: user1.id,
        role: :member
      })

      Castmill.Repo.insert!(%Castmill.Organizations.OrganizationsUsers{
        organization_id: organization.id,
        user_id: user2.id,
        role: :member
      })

      Castmill.Repo.insert!(%Castmill.Organizations.OrganizationsUsers{
        organization_id: organization.id,
        user_id: user3.id,
        role: :admin
      })

      # Should now have 3 users
      assert Quotas.get_quota_used_for_organization(
               organization.id,
               Castmill.Organizations.OrganizationsUsers
             ) == 3

      # Test with another organization - should be isolated
      organization2 = organization_fixture(%{name: "Another Org", network_id: network.id})

      assert Quotas.get_quota_used_for_organization(
               organization2.id,
               Castmill.Organizations.OrganizationsUsers
             ) == 0

      # Add one user to organization2
      user4 = user_fixture(%{email: "user4@test.com", network_id: network.id})

      Castmill.Repo.insert!(%Castmill.Organizations.OrganizationsUsers{
        organization_id: organization2.id,
        user_id: user4.id,
        role: :member
      })

      # organization2 should have 1 user, organization1 should still have 3
      assert Quotas.get_quota_used_for_organization(
               organization2.id,
               Castmill.Organizations.OrganizationsUsers
             ) == 1

      assert Quotas.get_quota_used_for_organization(
               organization.id,
               Castmill.Organizations.OrganizationsUsers
             ) == 3
    end
  end
end
