defmodule Castmill.OrganizationsUsersTest do
  use Castmill.DataCase

  alias Castmill.Organizations

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
      assert result == [[user, :admin]]
    end

    test "remove_user/2 removes the user from the organization" do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})
      user = user_fixture()

      Organizations.add_user(organization.id, user.id, :admin)

      assert {:ok, "User successfully removed."} = Organizations.remove_user(organization.id, user.id)
      assert [] == Organizations.list_users(organization.id)
    end

    test "get_user!/1 returns the user with given id" do
      user = user_fixture()
      assert Organizations.get_user!(user.id) == user
    end

    test "create_user/1 with valid data creates a user" do
      valid_attrs = %{avatar: "https://example.com/avatar", email: "john@doe.com", name: "some name"}

      assert {:ok, %User{} = user} = Organizations.create_user(valid_attrs)
      assert user.avatar == "https://example.com/avatar"
      assert user.email == "john@doe.com"
      assert user.name == "some name"
    end

    test "create_user/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Organizations.create_user(@invalid_attrs)
    end

    test "update_user/2 with valid data updates the user" do
      avatar = "https://example.com/updated-avatar"
      email = "updated@email.com"
      user = user_fixture()
      update_attrs = %{avatar: avatar, email: email, name: "some updated name"}

      assert {:ok, %User{} = user} = Organizations.update_user(user, update_attrs)
      assert user.avatar == avatar
      assert user.email == email
      assert user.name == "some updated name"
    end

    test "update_user/2 with invalid data returns error changeset" do
      user = user_fixture()
      assert {:error, %Ecto.Changeset{}} = Organizations.update_user(user, @invalid_attrs)
      assert user == Organizations.get_user!(user.id)
    end

    test "delete_user/1 deletes the user" do
      user = user_fixture()
      assert {:ok, %User{}} = Organizations.delete_user(user)
      assert_raise Ecto.NoResultsError, fn -> Organizations.get_user!(user.id) end
    end

    test "change_user/1 returns a user changeset" do
      user = user_fixture()
      assert %Ecto.Changeset{} = Organizations.change_user(user)
    end
  end
end
