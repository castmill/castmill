defmodule Castmill.PlaylistsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  playlist related entities.
  """

  alias Castmill.Repo
  alias Castmill.Widgets.Integrations.WidgetIntegration
  alias Castmill.Widgets.Widget

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
    unique_id = System.unique_integer([:positive])

    defaults = %{
      name: "Widget #{unique_id}",
      slug: "widget-#{unique_id}",
      template: %{"components" => []},
      options_schema: %{},
      data_schema: %{}
    }

    attrs = Enum.into(attrs, defaults)

    %Widget{}
    |> Widget.changeset(attrs)
    |> Repo.insert!()
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

  @doc """
  Create a widget integration fixture.
  """
  def widget_integration_fixture(attrs \\ %{}) do
    widget = Map.get(attrs, :widget)

    attrs =
      attrs
      |> Map.delete(:widget)
      |> Enum.into(%{})
      |> Map.put_new(:widget_id, (widget || widget_fixture()).id)

    defaults = %{
      name: "integration-#{System.unique_integer([:positive])}",
      description: "Test widget integration",
      integration_type: "pull",
      credential_scope: "organization",
      discriminator_type: "widget_option",
      discriminator_key: "feed_url",
      pull_endpoint: "https://example.com/#{System.unique_integer([:positive])}",
      pull_interval_seconds: 300,
      pull_config: %{
        "auth_type" => "optional",
        "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.TestStub"
      }
    }

    attrs = Map.merge(defaults, attrs)

    %WidgetIntegration{}
    |> WidgetIntegration.changeset(attrs)
    |> Repo.insert!()
  end
end
