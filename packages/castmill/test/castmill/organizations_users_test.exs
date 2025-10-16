defmodule Castmill.OrganizationsUsersTest do
  use Castmill.DataCase

  alias Castmill.Organizations
  alias Castmill.Accounts

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  describe "organizations users" do
    alias Castmill.Accounts.User

    import Castmill.OrganizationsFixtures

    @invalid_attrs %{avatar: "wrong avatar", email: "wrong email", name: nil}

    test "list_users/1 returns all users in an organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      user = user_fixture()

      Organizations.add_user(organization.id, user.id, :admin)

      result = Organizations.list_users(%{organization_id: organization.id})

      expected_result = [
        %{
          user_id: user.id,
          user: %{
            avatar: user.avatar,
            email: user.email,
            id: user.id,
            name: user.name
          },
          role: :admin,
          inserted_at: List.first(result).inserted_at
        }
      ]

      assert result == expected_result
    end

    test "remove_user/2 removes the user from the organization when multiple users exist" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      user = user_fixture()
      admin = user_fixture()

      Organizations.add_user(organization.id, admin.id, :admin)
      Organizations.add_user(organization.id, user.id, :member)

      assert {:ok, "User successfully removed."} =
               Organizations.remove_user(organization.id, user.id)

      remaining_users = Organizations.list_users(%{organization_id: organization.id})
      assert length(remaining_users) == 1
    end

    test "remove_user/2 prevents removing the last admin even with other members" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      admin = user_fixture()
      member = user_fixture()

      Organizations.add_user(organization.id, admin.id, :admin)
      Organizations.add_user(organization.id, member.id, :member)

      assert {:error, :last_admin} = Organizations.remove_user(organization.id, admin.id)

      remaining_roles =
        Organizations.list_users(%{organization_id: organization.id})
        |> Enum.map(& &1.role)

      assert :admin in remaining_roles
    end

    test "remove_user/2 allows removing an admin when another admin remains" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      admin_one = user_fixture()
      admin_two = user_fixture()

      Organizations.add_user(organization.id, admin_one.id, :admin)
      Organizations.add_user(organization.id, admin_two.id, :admin)

      assert {:ok, "User successfully removed."} =
               Organizations.remove_user(organization.id, admin_one.id)

      remaining_roles =
        Organizations.list_users(%{organization_id: organization.id})
        |> Enum.map(& &1.role)

      assert [:admin] = remaining_roles
    end

    test "remove_user/2 prevents removing a user from their last organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      user = user_fixture()
      admin = user_fixture()

      # Add admin to the organization
      Organizations.add_user(organization.id, admin.id, :admin)
      # Add user to the organization (this is their only organization)
      Organizations.add_user(organization.id, user.id, :member)

      # Should not be able to remove the user since it's their only organization
      assert {:error, :last_organization} = Organizations.remove_user(organization.id, user.id)

      # Verify user is still in the organization
      remaining_users = Organizations.list_users(%{organization_id: organization.id})
      assert length(remaining_users) == 2
    end

    test "remove_user/2 allows removing a user when they have multiple organizations" do
      network = network_fixture()
      organization_one = organization_fixture(%{network_id: network.id})
      organization_two = organization_fixture(%{network_id: network.id})
      user = user_fixture()
      admin_one = user_fixture()
      admin_two = user_fixture()

      # Add admins to both organizations
      Organizations.add_user(organization_one.id, admin_one.id, :admin)
      Organizations.add_user(organization_two.id, admin_two.id, :admin)

      # Add user to both organizations
      Organizations.add_user(organization_one.id, user.id, :member)
      Organizations.add_user(organization_two.id, user.id, :member)

      # Should be able to remove from one organization since user has another
      assert {:ok, "User successfully removed."} =
               Organizations.remove_user(organization_one.id, user.id)

      # Verify user is removed from organization one
      org_one_users = Organizations.list_users(%{organization_id: organization_one.id})
      assert length(org_one_users) == 1

      # Verify user is still in organization two
      org_two_users = Organizations.list_users(%{organization_id: organization_two.id})
      assert length(org_two_users) == 2
    end

    test "create_user/1 with valid data creates a user" do
      valid_attrs = %{
        avatar: "https://example.com/avatar",
        email: "john@doe.com",
        name: "some name"
      }

      assert {:ok, %User{} = user} = Accounts.create_user(valid_attrs)
      assert user.avatar == "https://example.com/avatar"
      assert user.email == "john@doe.com"
      assert user.name == "some name"
    end

    test "create_user/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Accounts.create_user(@invalid_attrs)
    end

    test "change_user/1 returns a user changeset" do
      user = user_fixture()
      assert %Ecto.Changeset{} = Organizations.change_user(user)
    end

    test "has_any_role?/3 matches member role" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      user = user_fixture()

      Organizations.add_user(organization.id, user.id, :member)

      assert Organizations.has_any_role?(organization.id, user.id, [:admin, :member])
      assert Organizations.has_any_role?(organization.id, user.id, ["member"])
      refute Organizations.has_any_role?(organization.id, user.id, [:admin])
    end
  end
end
