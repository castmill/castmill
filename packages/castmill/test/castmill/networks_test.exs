defmodule Castmill.NetworksTest do
  use Castmill.DataCase

  alias Castmill.Networks

  @moduletag :networks

  describe "networks" do
    alias Castmill.Networks.Network

    import Castmill.NetworksFixtures

    @invalid_attrs %{copyright: nil, domain: nil, email: nil, logo: nil, name: nil}

    test "list_networks/0 returns all networks" do
      network = network_fixture()
      # Reload to get the default_plan_id that was set after creation
      reloaded_network = Networks.get_network(network.id)
      assert Networks.list_networks() == [reloaded_network]
    end

    test "get_network/1 returns the network with given id" do
      network = network_fixture()
      # The returned network should match (with default_plan_id)
      reloaded_network = Networks.get_network(network.id)
      assert reloaded_network.id == network.id
      assert reloaded_network.default_plan_id != nil
    end

    test "create_network/1 with valid data creates a network" do
      valid_attrs = %{
        copyright: "some copyright",
        domain: "https://some.domain.com",
        email: "some@email.com",
        logo: "some logo",
        name: "some name"
      }

      assert {:ok, %Network{} = network} = Networks.create_network(valid_attrs)
      assert network.copyright == valid_attrs.copyright
      assert network.domain == valid_attrs.domain
      assert network.email == valid_attrs.email
      assert network.logo == valid_attrs.logo
      assert network.name == valid_attrs.name
    end

    test "create_network/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Networks.create_network(@invalid_attrs)
    end

    test "update_network/2 with valid data updates the network" do
      network = network_fixture()

      update_attrs = %{
        copyright: "some updated copyright",
        domain: "https://some-updated.domain",
        email: "some@updated.email.com",
        logo: "some updated logo",
        name: "some updated name"
      }

      assert {:ok, %Network{} = network} = Networks.update_network(network, update_attrs)
      assert network.copyright == update_attrs.copyright
      assert network.domain == update_attrs.domain
      assert network.email == update_attrs.email
      assert network.logo == update_attrs.logo
      assert network.name == update_attrs.name
    end

    test "update_network/2 with invalid data returns error changeset" do
      network = network_fixture()
      assert {:error, %Ecto.Changeset{}} = Networks.update_network(network, @invalid_attrs)
      # Compare the reloaded network (both will have default_plan_id)
      reloaded_network = Networks.get_network(network.id)
      assert reloaded_network.id == network.id
    end

    test "delete_network/1 deletes the network" do
      network = network_fixture()
      assert {:ok, %Network{}} = Networks.delete_network(network)
      assert nil == Networks.get_network(network.id)
    end

    test "change_network/1 returns a network changeset" do
      network = network_fixture()
      assert %Ecto.Changeset{} = Networks.change_network(network)
    end

    test "create_network/1 automatically creates and assigns a default plan" do
      valid_attrs = %{
        copyright: "some copyright",
        domain: "https://auto-plan-test.com",
        email: "auto@plan.com",
        logo: "some logo",
        name: "Auto Plan Test Network"
      }

      assert {:ok, %Network{} = network} = Networks.create_network(valid_attrs)

      # Reload the network to get the default_plan_id
      reloaded_network = Networks.get_network(network.id)

      # Should have a default_plan_id assigned
      assert reloaded_network.default_plan_id != nil

      # The plan should exist
      plans = Castmill.Quotas.list_plans(network.id)
      assert length(plans) == 1

      default_plan = List.first(plans)
      assert default_plan.id == reloaded_network.default_plan_id
      assert default_plan.name == "Default Plan"
    end

    test "organizations in new network inherit default plan quotas" do
      valid_attrs = %{
        copyright: "some copyright",
        domain: "https://org-inherit-test.com",
        email: "inherit@test.com",
        logo: "some logo",
        name: "Org Inherit Test Network"
      }

      assert {:ok, %Network{} = network} = Networks.create_network(valid_attrs)

      # Create an organization in this network
      org =
        Castmill.OrganizationsFixtures.organization_fixture(%{
          network_id: network.id,
          name: "Test Org"
        })

      # Organization should inherit quotas from network's default plan
      assert Castmill.Quotas.get_quota_for_organization(org.id, "teams") == 10
      assert Castmill.Quotas.get_quota_for_organization(org.id, "medias") == 1000
      assert Castmill.Quotas.get_quota_for_organization(org.id, "playlists") == 50
      assert Castmill.Quotas.get_quota_for_organization(org.id, "devices") == 20
      assert Castmill.Quotas.get_quota_for_organization(org.id, "channels") == 20
    end

    test "invitation_only defaults to false" do
      network = network_fixture()
      assert network.invitation_only == false
    end

    test "update_network/2 can enable invitation_only mode" do
      network = network_fixture()

      update_attrs = %{invitation_only: true}

      assert {:ok, %Network{} = updated_network} =
               Networks.update_network(network, update_attrs)

      assert updated_network.invitation_only == true
    end

    test "invitation_only_org_admins defaults to false" do
      network = network_fixture()
      assert network.invitation_only_org_admins == false
    end
  end

  describe "network invitations" do
    import Castmill.NetworksFixtures

    test "invite_user_to_new_organization/3 creates an invitation" do
      network = network_fixture()
      email = "newuser@example.com"
      org_name = "New Organization"

      assert {:ok, invitation} =
               Networks.invite_user_to_new_organization(network.id, email, org_name)

      assert invitation.email == email
      assert invitation.organization_name == org_name
      assert invitation.network_id == network.id
      assert invitation.status == "invited"
      assert invitation.token != nil
    end

    test "invite_user_to_new_organization/3 fails for existing user" do
      network = network_fixture()
      # Create a user in the network
      {:ok, _user} =
        Castmill.Accounts.create_user(%{
          name: "Test User",
          email: "existing@example.com",
          network_id: network.id
        })

      assert {:error, message} =
               Networks.invite_user_to_new_organization(
                 network.id,
                 "existing@example.com",
                 "New Org"
               )

      assert message =~ "already exists"
    end

    test "invite_user_to_new_organization/3 fails for duplicate invitation" do
      network = network_fixture()
      email = "duplicate@example.com"

      {:ok, _} = Networks.invite_user_to_new_organization(network.id, email, "Org 1")

      assert {:error, message} =
               Networks.invite_user_to_new_organization(network.id, email, "Org 2")

      assert message =~ "already exists"
    end

    test "get_network_invitation_by_token/1 returns invitation" do
      network = network_fixture()

      {:ok, invitation} =
        Networks.invite_user_to_new_organization(network.id, "test@example.com", "Test Org")

      found = Networks.get_network_invitation_by_token(invitation.token)
      assert found.id == invitation.id
      assert found.email == invitation.email
    end

    test "list_network_invitations/1 returns network invitations" do
      network = network_fixture()

      {:ok, _inv1} =
        Networks.invite_user_to_new_organization(network.id, "user1@example.com", "Org 1")

      {:ok, _inv2} =
        Networks.invite_user_to_new_organization(network.id, "user2@example.com", "Org 2")

      invitations = Networks.list_network_invitations(network.id)
      assert length(invitations) == 2
    end

    test "delete_network_invitation/1 removes invitation" do
      network = network_fixture()

      {:ok, invitation} =
        Networks.invite_user_to_new_organization(network.id, "delete@example.com", "Test Org")

      assert {:ok, _} = Networks.delete_network_invitation(invitation.id)
      assert Networks.get_network_invitation_by_token(invitation.token) == nil
    end
  end
end
