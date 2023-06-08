defmodule Castmill.FilesFixtures do
  @moduledoc """
  This module defines test helpers for creating
  file related entities.
  """

  @doc """
  Create a file
  """
  def file_fixture(attrs \\ %{}) do
    {:ok, file} =
      attrs
      |> Enum.into(%{
        name: "Hangar 42",
        uri: "https://some.url.com",
        size: 123,
        mimetype: "video/mp4"
      })
      |> Castmill.Files.create_file()
  end
end
