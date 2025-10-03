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
        domain: "some.domain.com",
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
        domain: "some updated domain",
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
        domain: "auto-plan-test.com",
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
        domain: "org-inherit-test.com",
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
  end
end
