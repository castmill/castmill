defmodule Castmill.AccountsTest do
  use Castmill.DataCase

  alias Castmill.Accounts

  describe "access_tokens" do
    alias Castmill.Accounts.AccessToken

    import Castmill.AccountsFixtures
    import Castmill.OrganizationsFixtures

    @invalid_attrs %{accessed: nil, accessed_at: nil, last_ip: nil}

    test "get_user_by_access_token/2 returns the user related to the given access token" do
      user = user_fixture()
      access_token = access_token_fixture(%{secret: "some secret", user_id: user.id})

      {:ok, fetched_user} = Accounts.get_user_by_access_token(access_token.secret, "192.168.1.2")

      assert fetched_user == Map.merge(user, %{is_root: false})
    end

    test "get_access_token!/1 returns the access_token with given id" do
      user = user_fixture()

      access_token =
        access_token_fixture(%{secret: "some secret", user_id: user.id, is_root: true})

      fetched_access_token = Accounts.get_access_token!(access_token.id)
      assert fetched_access_token.secret == nil
      assert fetched_access_token.user_id == user.id
      assert fetched_access_token.is_root == true
      assert fetched_access_token.accessed == 0
    end

    test "get_user_by_access_token/2 updates the last used ip and incresses accessed" do
      user = user_fixture()
      access_token = access_token_fixture(%{secret: "some secret", user_id: user.id})

      ip = "192.168.1.2"
      {:ok, fetched_user} = Accounts.get_user_by_access_token(access_token.secret, ip)

      assert fetched_user == Map.merge(user, %{is_root: false})

      fetched_access_token = Accounts.get_access_token!(access_token.id)

      assert fetched_access_token.last_ip == "192.168.1.2"
      assert fetched_access_token.accessed == 1
    end

    test "create_access_token/1 with valid data creates a access_token" do
      user = user_fixture()

      valid_attrs = %{
        secret: "some secret",
        user_id: user.id,
        is_root: true
      }

      assert {:ok, %AccessToken{} = access_token} = Accounts.create_access_token(valid_attrs)
      assert access_token.secret == valid_attrs.secret
      assert access_token.user_id == user.id
      assert access_token.is_root == true
      assert access_token.accessed == 0
    end

    test "create_access_token/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Accounts.create_access_token(@invalid_attrs)
    end

    # test "update_access_token/2 with valid data updates the access_token" do
    #   access_token = access_token_fixture()
    #   update_attrs = %{accessed: 43, accessed_at: ~D[2023-03-26], last_ip: "some updated last_ip"}

    #   assert {:ok, %AccessToken{} = access_token} = Accounts.update_access_token(access_token, update_attrs)
    #   assert access_token.accessed == 43
    #   assert access_token.accessed_at == ~D[2023-03-26]
    #   assert access_token.last_ip == "some updated last_ip"
    # end

    # test "update_access_token/2 with invalid data returns error changeset" do
    #   access_token = access_token_fixture()
    #   assert {:error, %Ecto.Changeset{}} = Accounts.update_access_token(access_token, @invalid_attrs)
    #   assert access_token == Accounts.get_access_token!(access_token.id)
    # end

    test "delete_access_token/1 deletes the access_token" do
      user = user_fixture()
      access_token = access_token_fixture(%{secret: "some secret", user_id: user.id})

      assert {:ok, %AccessToken{}} = Accounts.delete_access_token(access_token)
      assert_raise Ecto.NoResultsError, fn -> Accounts.get_access_token!(access_token.id) end
    end
  end

  describe "delete_user/1" do
    import Castmill.OrganizationsFixtures
    import Castmill.NetworksFixtures

    setup do
      # Create a network for testing
      network = network_fixture(%{name: "Test Network", domain: "test.example.com"})
      %{network: network}
    end

    test "deletes user and their sole-owned organization when user is the only member", %{
      network: network
    } do
      # Create user with organization
      user =
        user_fixture(%{
          email: "solo@example.com",
          name: "Solo User",
          network_id: network.id
        })

      organization =
        organization_fixture(%{
          name: "Solo Org",
          network_id: network.id
        })

      # Add user as admin (only member)
      {:ok, _} =
        Castmill.Organizations.add_user(organization.id, user.id, :admin)

      # Verify setup
      assert Castmill.Repo.get(Castmill.Accounts.User, user.id) != nil
      assert Castmill.Repo.get(Castmill.Organizations.Organization, organization.id) != nil

      # Delete user
      assert {:ok, message} = Accounts.delete_user(user.id)
      assert message == "User successfully deleted."

      # Verify user is deleted
      assert Castmill.Repo.get(Castmill.Accounts.User, user.id) == nil

      # Verify organization is also deleted (no dangling orgs)
      assert Castmill.Repo.get(Castmill.Organizations.Organization, organization.id) == nil
    end

    test "prevents deletion when user is sole admin with other members", %{network: network} do
      # Create admin user
      admin_user =
        user_fixture(%{
          email: "admin@example.com",
          name: "Admin User",
          network_id: network.id
        })

      # Create regular member
      member_user =
        user_fixture(%{
          email: "member@example.com",
          name: "Member User",
          network_id: network.id
        })

      organization =
        organization_fixture(%{
          name: "Team Org",
          network_id: network.id
        })

      # Add admin as admin
      {:ok, _} =
        Castmill.Organizations.add_user(organization.id, admin_user.id, :admin)

      # Add member as member
      {:ok, _} =
        Castmill.Organizations.add_user(organization.id, member_user.id, :member)

      # Try to delete admin user
      assert {:error, message} = Accounts.delete_user(admin_user.id)

      assert message =~
               "Cannot delete account. You are the sole administrator of 'Team Org' which has other members"

      # Verify user and organization still exist
      assert Castmill.Repo.get(Castmill.Accounts.User, admin_user.id) != nil
      assert Castmill.Repo.get(Castmill.Organizations.Organization, organization.id) != nil
    end

    test "allows deletion when there are other admins in organization", %{network: network} do
      # Create first admin
      admin1 =
        user_fixture(%{
          email: "admin1@example.com",
          name: "Admin One",
          network_id: network.id
        })

      # Create second admin
      admin2 =
        user_fixture(%{
          email: "admin2@example.com",
          name: "Admin Two",
          network_id: network.id
        })

      organization =
        organization_fixture(%{
          name: "Multi Admin Org",
          network_id: network.id
        })

      # Add both as admins
      {:ok, _} =
        Castmill.Organizations.add_user(organization.id, admin1.id, :admin)

      {:ok, _} =
        Castmill.Organizations.add_user(organization.id, admin2.id, :admin)

      # Delete first admin should succeed
      assert {:ok, message} = Accounts.delete_user(admin1.id)
      assert message == "User successfully deleted."

      # Verify first admin is deleted
      assert Castmill.Repo.get(Castmill.Accounts.User, admin1.id) == nil

      # Verify organization still exists with second admin
      assert Castmill.Repo.get(Castmill.Organizations.Organization, organization.id) != nil
      assert Castmill.Repo.get(Castmill.Accounts.User, admin2.id) != nil
    end

    test "allows deletion when user is a regular member (not admin)", %{network: network} do
      # Create admin
      admin_user =
        user_fixture(%{
          email: "admin@example.com",
          name: "Admin User",
          network_id: network.id
        })

      # Create member
      member_user =
        user_fixture(%{
          email: "member@example.com",
          name: "Member User",
          network_id: network.id
        })

      organization =
        organization_fixture(%{
          name: "Test Org",
          network_id: network.id
        })

      # Add admin
      {:ok, _} =
        Castmill.Organizations.add_user(organization.id, admin_user.id, :admin)

      # Add member
      {:ok, _} =
        Castmill.Organizations.add_user(organization.id, member_user.id, :member)

      # Delete member should succeed
      assert {:ok, message} = Accounts.delete_user(member_user.id)
      assert message == "User successfully deleted."

      # Verify member is deleted
      assert Castmill.Repo.get(Castmill.Accounts.User, member_user.id) == nil

      # Verify organization and admin still exist
      assert Castmill.Repo.get(Castmill.Organizations.Organization, organization.id) != nil
      assert Castmill.Repo.get(Castmill.Accounts.User, admin_user.id) != nil
    end

    test "handles user in multiple organizations correctly", %{network: network} do
      # Create user
      user =
        user_fixture(%{
          email: "multi@example.com",
          name: "Multi Org User",
          network_id: network.id
        })

      # Create another admin for org2
      other_admin =
        user_fixture(%{
          email: "other@example.com",
          name: "Other Admin",
          network_id: network.id
        })

      # Create two organizations
      org1 = organization_fixture(%{name: "Org 1", network_id: network.id})
      org2 = organization_fixture(%{name: "Org 2", network_id: network.id})

      # Add user as only member of org1
      {:ok, _} = Castmill.Organizations.add_user(org1.id, user.id, :admin)

      # Add user as admin of org2 (with another admin)
      {:ok, _} = Castmill.Organizations.add_user(org2.id, user.id, :admin)
      {:ok, _} = Castmill.Organizations.add_user(org2.id, other_admin.id, :admin)

      # Delete user
      assert {:ok, message} = Accounts.delete_user(user.id)
      assert message == "User successfully deleted."

      # Verify user is deleted
      assert Castmill.Repo.get(Castmill.Accounts.User, user.id) == nil

      # Verify org1 is deleted (user was only member)
      assert Castmill.Repo.get(Castmill.Organizations.Organization, org1.id) == nil

      # Verify org2 still exists (has another admin)
      assert Castmill.Repo.get(Castmill.Organizations.Organization, org2.id) != nil
      assert Castmill.Repo.get(Castmill.Accounts.User, other_admin.id) != nil
    end

    test "prevents deletion when user is sole admin in multiple orgs with members", %{
      network: network
    } do
      # Create user
      admin_user =
        user_fixture(%{
          email: "admin@example.com",
          name: "Admin User",
          network_id: network.id
        })

      # Create members
      member1 =
        user_fixture(%{
          email: "member1@example.com",
          name: "Member 1",
          network_id: network.id
        })

      member2 =
        user_fixture(%{
          email: "member2@example.com",
          name: "Member 2",
          network_id: network.id
        })

      # Create two organizations
      org1 = organization_fixture(%{name: "Org 1", network_id: network.id})
      org2 = organization_fixture(%{name: "Org 2", network_id: network.id})

      # Add admin as sole admin in both orgs
      {:ok, _} = Castmill.Organizations.add_user(org1.id, admin_user.id, :admin)
      {:ok, _} = Castmill.Organizations.add_user(org1.id, member1.id, :member)

      {:ok, _} = Castmill.Organizations.add_user(org2.id, admin_user.id, :admin)
      {:ok, _} = Castmill.Organizations.add_user(org2.id, member2.id, :member)

      # Try to delete admin
      assert {:error, message} = Accounts.delete_user(admin_user.id)

      # Should fail on the first org with other members
      assert message =~ "Cannot delete account. You are the sole administrator"
      assert message =~ "which has other members"

      # Verify nothing was deleted (transaction rollback)
      assert Castmill.Repo.get(Castmill.Accounts.User, admin_user.id) != nil
      assert Castmill.Repo.get(Castmill.Organizations.Organization, org1.id) != nil
      assert Castmill.Repo.get(Castmill.Organizations.Organization, org2.id) != nil
    end

    test "returns error for non-existent user", %{network: _network} do
      fake_user_id = Ecto.UUID.generate()

      assert {:error, :not_found} = Accounts.delete_user(fake_user_id)
    end
  end
end

