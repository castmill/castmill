defmodule Castmill.OrganizationsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Castmill.Organizations` context.
  """

  alias Castmill.NetworksFixtures

  @doc """
  Generate a organization.
  """
  def organization_fixture(attrs \\ %{}) do
    network = Map.get(attrs, :network) || NetworksFixtures.network_fixture()

    attrs =
      attrs
      |> Map.delete(:network)
      |> Enum.into(%{
        name: "some name"
      })
      |> Map.put_new(:network_id, network.id)

    {:ok, organization} = Castmill.Organizations.create_organization(attrs)

    organization
  end

  @doc """
  Generate a user
  """
  def user_fixture(attrs \\ %{}) do
    {:ok, user} =
      attrs
      |> Enum.into(%{
        avatar: "https://some.url.com",
        email: "some@email.com",
        name: "some name"
      })
      |> Castmill.Accounts.create_user()

    user
  end
end
