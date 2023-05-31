defmodule Castmill.PlaylistsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  playlist related entities.
  """

  @doc """
  Generate a access_token.
  """
  def playlist_fixture(attrs \\ %{}) do
    {:ok, playlist} =
      attrs
      |> Enum.into(%{
        name: "Hangar 42",
        settings: %{"opts" => "test"},
      })
      |> Castmill.Resources.create_playlist()

      playlist
  end
end
