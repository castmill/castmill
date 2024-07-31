defmodule Castmill.MediasFixtures do
  alias Castmill.Repo

  @moduledoc """
  This module defines test helpers for creating
  medias related entities.
  """

  @doc """
  Create a media fixture.
  """
  def media_fixture(attrs \\ %{}) do
    {:ok, media} =
      attrs
      |> Enum.into(%{
        name: "Hangar 42",
        mimetype: "video/mp4"
      })
      |> Castmill.Resources.create_media()

    Repo.preload(media, [:files_medias])
  end
end
