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

      assert {:ok, %Organization{} = organization} =
               Organizations.create_organization(valid_attrs)

      assert organization.name == "some name"
    end

    test "create_organization/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Organizations.create_organization(@invalid_attrs)
    end

    test "update_organization/2 with valid data updates the organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      update_attrs = %{name: "some updated name"}

      assert {:ok, %Organization{} = organization} =
               Organizations.update_organization(organization, update_attrs)

      assert organization.name == "some updated name"
    end

    test "update_organization/2 with invalid data returns error changeset" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      assert {:error, %Ecto.Changeset{}} =
               Organizations.update_organization(organization, @invalid_attrs)

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

    test "create_organization/1 with duplicate name in same network returns error" do
      network = network_fixture()
      valid_attrs = %{name: "duplicate name", network_id: network.id}

      assert {:ok, %Organization{}} = Organizations.create_organization(valid_attrs)
      assert {:error, %Ecto.Changeset{}} = Organizations.create_organization(valid_attrs)
    end

    test "create_organization/1 with duplicate name in different network succeeds" do
      network1 = network_fixture()
      network2 = network_fixture()

      attrs1 = %{name: "same name", network_id: network1.id}
      attrs2 = %{name: "same name", network_id: network2.id}

      assert {:ok, %Organization{}} = Organizations.create_organization(attrs1)
      assert {:ok, %Organization{}} = Organizations.create_organization(attrs2)
    end

    test "update_organization/2 with duplicate name in same network returns error" do
      network = network_fixture()
      organization1 = organization_fixture(%{network_id: network.id, name: "org1"})
      organization2 = organization_fixture(%{network_id: network.id, name: "org2"})

      assert {:error, %Ecto.Changeset{}} =
               Organizations.update_organization(organization2, %{name: "org1"})
    end

    test "is_name_available_in_network?/3 returns true for available name" do
      network = network_fixture()
      organization_fixture(%{network_id: network.id, name: "existing org"})

      assert Organizations.is_name_available_in_network?(
               network.id,
               "new org",
               nil
             ) == true
    end

    test "is_name_available_in_network?/3 returns false for taken name" do
      network = network_fixture()
      organization_fixture(%{network_id: network.id, name: "existing org"})

      assert Organizations.is_name_available_in_network?(
               network.id,
               "existing org",
               nil
             ) == false
    end

    test "is_name_available_in_network?/3 excludes current organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id, name: "my org"})

      assert Organizations.is_name_available_in_network?(
               network.id,
               "my org",
               organization.id
             ) == true
    end
  end
end
