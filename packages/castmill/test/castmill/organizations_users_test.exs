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

      result = Organizations.list_users(organization.id)
      assert result == [Map.put(user, :role, :admin)]
    end

    test "remove_user/2 removes the user from the organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      user = user_fixture()

      Organizations.add_user(organization.id, user.id, :admin)

      assert {:ok, "User successfully removed."} =
               Organizations.remove_user(organization.id, user.id)

      assert [] == Organizations.list_users(organization.id)
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
  end
end
