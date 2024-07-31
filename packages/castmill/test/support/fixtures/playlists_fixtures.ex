defmodule Castmill.PlaylistsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  playlist related entities.
  """

  @doc """
  Generate a playlist fixture with the given attributes.
  """
  def playlist_fixture(attrs \\ %{}) do
    {:ok, playlist} =
      attrs
      |> Enum.into(%{
        name: "Hangar 42",
        settings: %{"opts" => "test"}
      })
      |> Castmill.Resources.create_playlist()

    playlist
  end

  @doc """
    Create a widget fixture.
  """
  def widget_fixture(attrs \\ %{}) do
    %Castmill.Widgets.Widget{}
    |> Castmill.Widgets.Widget.changeset(attrs)
    |> Castmill.Repo.insert!()
  end

  @doc """
  Create a playlist item fixture.
  """
  def playlist_item_fixture(attrs \\ %{}) do
    %Castmill.Resources.PlaylistItem{}
    |> Castmill.Resources.PlaylistItem.changeset(attrs)
    |> Castmill.Repo.insert!()
  end

  @doc """
  Create a widget configuration fixture.
  """
  def widget_config_fixture(attrs \\ %{}) do
    %Castmill.Widgets.WidgetConfig{}
    |> Castmill.Widgets.WidgetConfig.changeset(attrs)
    |> Castmill.Repo.insert!()
  end
end
