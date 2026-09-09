defmodule Castmill.TagsFixtures do
  @moduledoc """
  Test helpers for creating tags-related entities.
  """

  alias Castmill.Tags

  @doc """
  Create a tag group fixture.
  """
  def tag_group_fixture(attrs \\ %{}) do
    unique = System.unique_integer([:positive])

    {:ok, tag_group} =
      attrs
      |> Enum.into(%{
        name: "Group #{unique}",
        color: "#3B82F6"
      })
      |> Tags.create_tag_group()

    tag_group
  end

  @doc """
  Create a tag fixture.
  """
  def tag_fixture(attrs \\ %{}) do
    unique = System.unique_integer([:positive])

    {:ok, tag} =
      attrs
      |> Enum.into(%{
        name: "Tag #{unique}",
        color: "#3B82F6"
      })
      |> Tags.create_tag()

    tag
  end
end
