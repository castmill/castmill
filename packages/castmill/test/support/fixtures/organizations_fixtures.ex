defmodule Castmill.OrganizationsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Castmill.Organizations` context.
  """

  @doc """
  Generate a organization.
  """
  def organization_fixture(attrs \\ %{}) do
    {:ok, organization} =
      attrs
      |> Enum.into(%{
        name: "some name"
      })
      |> Castmill.Organizations.create_organization()

    organization
  end

  @doc """
  Generate a user.
  """
  def user_fixture(attrs \\ %{}) do
    {:ok, user} =
      attrs
      |> Enum.into(%{
        avatar: "some avatar",
        email: "some email",
        name: "some name"
      })
      |> Castmill.Organizations.create_user()

    user
  end
end
