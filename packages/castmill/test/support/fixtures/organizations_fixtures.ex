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
  Generate a user.

  If `network_id` is provided in attrs, the user will be added to that network
  via the `networks_users` join table. If `network_role` is provided, it will
  be used as the role (defaults to `:member`).
  """
  def user_fixture(attrs \\ %{}) do
    unique_id = System.unique_integer([:positive])

    network_id = Map.get(attrs, :network_id)
    network_role = Map.get(attrs, :network_role, :member)

    user_attrs =
      attrs
      |> Map.drop([:network_id, :network_role])
      |> Enum.into(%{
        avatar: "https://some.url.com",
        email: "user_#{unique_id}@email.com",
        name: "User #{unique_id}"
      })

    {:ok, user} = Castmill.Accounts.create_user(user_attrs)

    # Add to network if network_id provided
    if network_id do
      {:ok, _} = Castmill.Networks.add_user_to_network(user.id, network_id, network_role)
    end

    user
  end
end
