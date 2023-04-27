defmodule Castmill.QuotasTest do
  use Castmill.DataCase

  @moduletag :quota_data_case

  alias Castmill.Quotas

  describe "quotas" do
    @describetag :quotas

    import Castmill.NetworksFixtures
    import Castmill.OrganizationsFixtures

    test "create_plan/2 creates a plan for all permitted resources" do
      assert plan = Quotas.create_plan("test plan", [
        %{max: 10, resource: :medias},
        %{max: 5, resource: :organizations}
      ])
    end

    test "assign_plan_to_network/2 assigns a plan to a given network" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      plan = Quotas.create_plan("test network plan", [
        %{max: 10, resource: :users},
        %{max: 5, resource: :organizations}
      ])

      assert Quotas.has_network_enough_quota?(network.id, :organizations, 5) == false

      assert Quotas.assign_plan_to_network(plan.name, network.id)

      assert Quotas.has_organization_enough_quota?(organization.id, :medias, 10) == false
      assert Quotas.has_network_enough_quota?(network.id, :organizations, 5) == true
      assert Quotas.has_network_enough_quota?(network.id, :organizations, 6) == false
      assert Quotas.has_network_enough_quota?(network.id, :users, 9) == true
    end

    test "assign_plan_to_organization/2 assigns a plan to a given organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      plan = Quotas.create_plan("test plan", [
        %{max: 10, resource: :medias},
        %{max: 5, resource: :organizations}
      ])

      assert Quotas.assign_plan_to_organization(plan.name, organization.id)
      assert Quotas.has_organization_enough_quota?(organization.id, :organizations, 5) == true

      assert Quotas.has_network_enough_quota?(network.id, :organizations, 1) == false
      assert Quotas.has_organization_enough_quota?(organization.id, :medias, 9) == true
      assert Quotas.has_organization_enough_quota?(organization.id, :organizations, 4) == true
    end

    test "add_quota_to_network/3 overrides a quota for a given network" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      plan = Quotas.create_plan("test network plan", [
        %{max: 10, resource: :users},
        %{max: 5, resource: :organizations}
      ])

      assert Quotas.assign_plan_to_network(plan.name, network.id)
      assert Quotas.has_network_enough_quota?(network.id, :organizations, 5) == true
      assert Quotas.has_network_enough_quota?(network.id, :organizations, 6) == false
      Quotas.add_quota_to_network(network.id, :organizations, 10)
      assert Quotas.has_network_enough_quota?(network.id, :organizations, 10) == true
    end

    test "add_quota_to_organization/3 overrides a quota for a given organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      plan = Quotas.create_plan("test plan", [
        %{max: 10, resource: :medias},
        %{max: 5, resource: :organizations}
      ])

      assert Quotas.assign_plan_to_organization(plan.name, organization.id)
      assert Quotas.has_organization_enough_quota?(organization.id, :medias, 10) == true
      assert Quotas.has_organization_enough_quota?(organization.id, :medias, 15) == false

      Quotas.add_quota_to_organization(organization.id, :medias, 15)
      assert Quotas.has_organization_enough_quota?(organization.id, :medias, 15) == true
    end

    test "list_plans/0 list plans" do
      plan = Quotas.create_plan("test plan", [
        %{max: 10, resource: :medias},
        %{max: 5, resource: :organizations}
      ])

      assert Quotas.list_plans() == [plan]
    end

    test "delete_plan/1 deletes plan" do
      plan = Quotas.create_plan("test plan", [
        %{max: 10, resource: :medias},
        %{max: 5, resource: :organizations}
      ])

      assert Quotas.delete_plan(plan.name)
      assert Quotas.list_plans() == []
    end

  end
end
