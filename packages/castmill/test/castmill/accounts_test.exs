defmodule Castmill.AccountsTest do
  use Castmill.DataCase

  alias Castmill.Accounts

  describe "access_tokens" do
    alias Castmill.Accounts.AccessToken

    import Castmill.AccountsFixtures

    @invalid_attrs %{accessed: nil, accessed_at: nil, last_ip: nil}

    test "list_access_tokens/0 returns all access_tokens" do
      access_token = access_token_fixture()
      assert Accounts.list_access_tokens() == [access_token]
    end

    test "get_access_token!/1 returns the access_token with given id" do
      access_token = access_token_fixture()
      assert Accounts.get_access_token!(access_token.id) == access_token
    end

    test "create_access_token/1 with valid data creates a access_token" do
      valid_attrs = %{accessed: 42, accessed_at: ~D[2023-03-25], last_ip: "some last_ip"}

      assert {:ok, %AccessToken{} = access_token} = Accounts.create_access_token(valid_attrs)
      assert access_token.accessed == 42
      assert access_token.accessed_at == ~D[2023-03-25]
      assert access_token.last_ip == "some last_ip"
    end

    test "create_access_token/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Accounts.create_access_token(@invalid_attrs)
    end

    test "update_access_token/2 with valid data updates the access_token" do
      access_token = access_token_fixture()
      update_attrs = %{accessed: 43, accessed_at: ~D[2023-03-26], last_ip: "some updated last_ip"}

      assert {:ok, %AccessToken{} = access_token} = Accounts.update_access_token(access_token, update_attrs)
      assert access_token.accessed == 43
      assert access_token.accessed_at == ~D[2023-03-26]
      assert access_token.last_ip == "some updated last_ip"
    end

    test "update_access_token/2 with invalid data returns error changeset" do
      access_token = access_token_fixture()
      assert {:error, %Ecto.Changeset{}} = Accounts.update_access_token(access_token, @invalid_attrs)
      assert access_token == Accounts.get_access_token!(access_token.id)
    end

    test "delete_access_token/1 deletes the access_token" do
      access_token = access_token_fixture()
      assert {:ok, %AccessToken{}} = Accounts.delete_access_token(access_token)
      assert_raise Ecto.NoResultsError, fn -> Accounts.get_access_token!(access_token.id) end
    end

    test "change_access_token/1 returns a access_token changeset" do
      access_token = access_token_fixture()
      assert %Ecto.Changeset{} = Accounts.change_access_token(access_token)
    end
  end
end
