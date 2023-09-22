defmodule Castmill.OrganizationsAccessTest do
  use Castmill.DataCase

  alias Castmill.Organizations

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  describe "organizations access" do
    alias Castmill.Organizations.OrganizationsUsersAccess

    test "give_access/4 gives access to a given resource type for a given action" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      user = user_fixture(%{network_id: network.id, role: "member"})

      organizationId = organization.id
      userId = user.id

      assert %OrganizationsUsersAccess{
               access: "some_resource:some_action",
               organization_id: ^organizationId,
               user_id: ^userId
             } =
               Organizations.give_access(organization.id, user.id, "some_resource", "some_action")

      assert Organizations.has_access(organization.id, user.id, "some_resource", "some_action")

      # Test that other resource or action does not have access
      refute Organizations.has_access(
               organization.id,
               user.id,
               "some_other_resource",
               "some_action"
             )

      refute Organizations.has_access(organization.id, user.id, "some_other", "some_other_action")
    end

    test "remove_access/4 removes access to a given resource type for a given action" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      user = user_fixture(%{network_id: network.id, role: "member"})

      organizationId = organization.id
      userId = user.id

      assert %OrganizationsUsersAccess{
               access: "some_resource:some_action",
               organization_id: ^organizationId,
               user_id: ^userId
             } =
               Organizations.give_access(organization.id, user.id, "some_resource", "some_action")

      assert Organizations.has_access(organization.id, user.id, "some_resource", "some_action")

      Organizations.remove_access(organization.id, user.id, "some_resource", "some_action")

      refute Organizations.has_access(organization.id, user.id, "some_resource", "some_action")
    end

    test "give_access/4 does nothing if given access already exists" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      user = user_fixture(%{network_id: network.id, role: "member"})

      organizationId = organization.id
      userId = user.id

      assert %OrganizationsUsersAccess{
               access: "some_resource:some_action",
               organization_id: ^organizationId,
               user_id: ^userId
             } =
               Organizations.give_access(organization.id, user.id, "some_resource", "some_action")

      assert Organizations.has_access(organization.id, user.id, "some_resource", "some_action")

      Organizations.give_access(organization.id, user.id, "some_resource", "some_action")

      assert Organizations.has_access(organization.id, user.id, "some_resource", "some_action")

      Organizations.remove_access(organization.id, user.id, "some_resource", "some_action")

      refute Organizations.has_access(organization.id, user.id, "some_resource", "some_action")
    end

    test "has_access/4 returns true if users has access on a parent organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id, name: "child organization"})

      parent_organization =
        organization_fixture(%{
          network_id: network.id,
          organization_id: organization.id,
          name: "parent organization"
        })

      user = user_fixture(%{network_id: network.id, role: "member"})

      organizationId = parent_organization.id
      userId = user.id

      assert %OrganizationsUsersAccess{
               access: "some_resource:some_action",
               organization_id: ^organizationId,
               user_id: ^userId
             } =
               Organizations.give_access(
                 parent_organization.id,
                 user.id,
                 "some_resource",
                 "some_action"
               )

      assert Organizations.has_access(organization.id, user.id, "some_resource", "some_action")
    end

    test "has_access/4 returns true if users has access on a grand parent organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id, name: "child organization"})

      parent_organization =
        organization_fixture(%{
          network_id: network.id,
          organization_id: organization.id,
          name: "parent organization"
        })

      grand_parent_organization =
        organization_fixture(%{
          network_id: network.id,
          organization_id: parent_organization.id,
          name: "grand father organization"
        })

      user = user_fixture(%{network_id: network.id, role: "member"})

      organizationId = parent_organization.id
      userId = user.id

      assert %OrganizationsUsersAccess{
               access: "some_resource:some_action",
               organization_id: ^organizationId,
               user_id: ^userId
             } =
               Organizations.give_access(
                 parent_organization.id,
                 user.id,
                 "some_resource",
                 "some_action"
               )

      assert Organizations.has_access(organization.id, user.id, "some_resource", "some_action")

      assert Organizations.has_access(
               parent_organization.id,
               user.id,
               "some_resource",
               "some_action"
             )

      assert Organizations.has_access(
               grand_parent_organization.id,
               user.id,
               "some_resource",
               "some_action"
             )
    end
  end
end
