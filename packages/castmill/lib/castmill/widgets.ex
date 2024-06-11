defmodule Castmill.Widgets do
  @moduledoc """
  The Widgets context.
  """
  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Protocol.Access
  alias Castmill.Widgets.Widget
  alias Castmill.Widgets.WidgetConfig

  defimpl Access, for: Widget do
    def canAccess(_team, user, _action) do
      if user == nil do
        {:error, "No user provided"}
      else
        # network_admin = Repo.get_by(Castmill.Networks.NetworksAdmins, network_id: network.id, user_id: user.id)
        # if network_admin !== nil do
        #   {:ok, true}
        # else
        #   {:ok, false}
        # end
      end
    end
  end

  @doc """
  Returns the list of widgets.

  ## Examples

      iex> list_widgets()
      [%Widget{}, ...]
  """
  def list_widgets() do
    Widget.base_query()
    |> Repo.all()
  end

  @doc """
  Gets a widget by its id.

  ## Examples

      iex> get_widget("1234")
      %Widget{}
  """
  def get_widget(id), do: Repo.get(Widget, id)

  @doc """
  Gets a widget by name.
  """
  def get_widget_by_name(name), do: Repo.get_by(Widget, name: name)

  @doc """
  Instantiate a new widget.
  A widget instance is represented by a row in the widgets_config table.

  TODO:
  The data should be fetched from the widgets webhook endpoint, so a new widget instance will always have
  some valid data.

  We would possible like to encrypt this data before storing it in the database with a key that is unique
  for the organization that owns the widget instance.

  ## Examples

      iex> new_widget_config("w_id", "pii_id", %{ "foo" => "bar" })
      %WidgetConfig{}
  """
  def new_widget_config(widget_id, playlist_item_id, options, data \\ nil) do
    %WidgetConfig{}
    |> WidgetConfig.changeset(%{
      widget_id: widget_id,
      playlist_item_id: playlist_item_id,
      options: options,
      data: data,
      version: 1,
      last_request_at: nil
    })
    |> Repo.insert()
  end

  def get_widget_by_slug(slug) do
    Widget
    |> where([w], w.slug == ^slug)
    |> Repo.one()
  end
end
