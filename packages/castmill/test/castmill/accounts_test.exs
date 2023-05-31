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

      assert fetched_user == Map.merge(user, %{is_root: :false})
    end

    test "get_access_token!/1 returns the access_token with given id" do
      user = user_fixture()
      access_token = access_token_fixture(%{secret: "some secret", user_id: user.id, is_root: :true})

      fetched_access_token = Accounts.get_access_token!(access_token.id)
      assert fetched_access_token.secret == nil
      assert fetched_access_token.user_id == user.id
      assert fetched_access_token.is_root == true
      assert fetched_access_token.accessed == 0
    end

    test "get_user_by_access_token/2 updates the last used ip and incresses accessed" do
      user = user_fixture()
      access_token = access_token_fixture(%{secret: "some secret", user_id: user.id})

      ip =  "192.168.1.2"
      {:ok, fetched_user} = Accounts.get_user_by_access_token(access_token.secret, ip)

      assert fetched_user == Map.merge(user, %{is_root: :false})

      fetched_access_token = Accounts.get_access_token!(access_token.id)

      assert fetched_access_token.last_ip == "192.168.1.2"
      assert fetched_access_token.accessed == 1
    end

    test "create_access_token/1 with valid data creates a access_token" do
      user = user_fixture()
      valid_attrs = %{
        secret: "some secret",
        user_id: user.id,
        is_root: :true
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
end
