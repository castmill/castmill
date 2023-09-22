defmodule Castmill.MediasFixtures do
  @moduledoc """
  This module defines test helpers for creating
  medias related entities.
  """

  @doc """
  Generate a access_token.
  """
  def media_fixture(attrs \\ %{}) do
    {:ok, media} =
      attrs
      |> Enum.into(%{
        name: "Hangar 42",
        mimetype: "video/mp4"
      })
      |> Castmill.Resources.create_media()

    media
  end
end
