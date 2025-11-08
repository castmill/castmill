defmodule Castmill.AccountsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Castmill.Accounts` context.
  """

  alias Castmill.Repo
  alias Castmill.Accounts.SignUp

  @doc """
  Generate a access_token.
  """
  def access_token_fixture(attrs \\ %{}) do
    {:ok, access_token} =
      attrs
      |> Enum.into(%{
        accessed: 42,
        last_accessed: ~D[2023-03-25],
        last_ip: "some last_ip"
      })
      |> Castmill.Accounts.create_access_token()

    access_token
  end

  def signup_fixture(attrs \\ %{}) do
    %SignUp{}
    |> SignUp.changeset(attrs)
    |> Repo.insert!()
  end

  @doc """
  Generate a user with organization.
  """
  def user_fixture(attrs \\ %{}) do
    organization_id = attrs[:organization_id] || raise "organization_id is required"
    
    {:ok, user} =
      attrs
      |> Enum.into(%{
        email: "user#{System.unique_integer([:positive])}@example.com",
        organization_id: organization_id
      })
      |> Castmill.Accounts.create_user()

    user
  end
end
