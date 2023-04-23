defmodule Castmill.OrganizationsTest do
  use Castmill.DataCase

  alias Castmill.Organizations

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  describe "organizations" do
    alias Castmill.Organizations.Organization

    @invalid_attrs %{name: nil}

    test "list_organizations/0 returns all organizations" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      assert Organizations.list_organizations() == [organization]
    end

    test "get_organization!/1 returns the organization with given id" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      assert Organizations.get_organization!(organization.id) == organization
    end

    test "create_organization/1 with valid data creates a organization" do
      network = network_fixture()
      valid_attrs = %{name: "some name", network_id: network.id}

      assert {:ok, %Organization{} = organization} = Organizations.create_organization(valid_attrs)
      assert organization.name == "some name"
    end

    test "create_organization/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Organizations.create_organization(@invalid_attrs)
    end

    test "update_organization/2 with valid data updates the organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      update_attrs = %{name: "some updated name"}

      assert {:ok, %Organization{} = organization} = Organizations.update_organization(organization, update_attrs)
      assert organization.name == "some updated name"
    end

    test "update_organization/2 with invalid data returns error changeset" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      assert {:error, %Ecto.Changeset{}} = Organizations.update_organization(organization, @invalid_attrs)
      assert organization == Organizations.get_organization!(organization.id)
    end

    test "delete_organization/1 deletes the organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      assert {:ok, %Organization{}} = Organizations.delete_organization(organization)
      assert_raise Ecto.NoResultsError, fn -> Organizations.get_organization!(organization.id) end
    end

    test "change_organization/1 returns a organization changeset" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      assert %Ecto.Changeset{} = Organizations.change_organization(organization)
    end
  end
end
