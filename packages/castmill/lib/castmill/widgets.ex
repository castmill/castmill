defmodule Castmill.Widgets do
  @moduledoc """
  The Widgets context.
  """
  import Ecto.Query, warn: false

  alias Castmill.Repo
  alias Castmill.Protocol.Access
  alias Castmill.Widgets.Widget
  alias Castmill.Widgets.WidgetConfig
  alias Castmill.QueryHelpers

  defimpl Access, for: Widget do
    def canAccess(_team, user, _action) do
      if is_nil(user) do
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
  Returns the list of widgets with optional pagination, search, and sorting.

  ## Examples

      iex> list_widgets()
      [%Widget{}, ...]

      iex> list_widgets(%{page: 1, page_size: 10, search: "text"})
      [%Widget{}, ...]
  """
  def list_widgets(params \\ %{})

  def list_widgets(%{
        page: page,
        page_size: page_size,
        search: search,
        key: sort_key,
        direction: sort_direction
      }) do
    offset = (page_size && max((page - 1) * page_size, 0)) || 0

    # Convert sort direction string to atom
    sort_dir =
      case sort_direction do
        "ascending" -> :asc
        "descending" -> :desc
        _ -> :asc
      end

    # Convert sort key string to atom, default to :name
    sort_field =
      case sort_key do
        "name" -> :name
        "inserted_at" -> :inserted_at
        "updated_at" -> :updated_at
        _ -> :name
      end

    Widget.base_query()
    |> QueryHelpers.where_name_like(search)
    |> order_by([w], [{^sort_dir, field(w, ^sort_field)}])
    |> limit(^page_size)
    |> offset(^offset)
    |> Repo.all()
  end

  def list_widgets(_params) do
    Widget.base_query()
    |> Repo.all()
  end

  @doc """
  Returns the count of widgets matching the search criteria.

  ## Examples

      iex> count_widgets()
      5

      iex> count_widgets(%{search: "text"})
      2
  """
  def count_widgets(params \\ %{})

  def count_widgets(%{search: search}) do
    Widget.base_query()
    |> QueryHelpers.where_name_like(search)
    |> Repo.aggregate(:count, :id)
  end

  def count_widgets(_params) do
    Widget.base_query()
    |> Repo.aggregate(:count, :id)
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

  def update_widget_config(playlist_id, playlist_item_id, options, data) do
    # Define the current timestamp for the last_request_at field
    current_timestamp = DateTime.utc_now()

    # Directly use keyword list for the update clause
    {count, _} =
      from(wc in WidgetConfig,
        join: pi in assoc(wc, :playlist_item),
        where: pi.playlist_id == ^playlist_id and pi.id == ^playlist_item_id,
        update: [
          set: [
            options: ^options,
            data: ^data,
            last_request_at: ^current_timestamp,
            version: fragment("version + 1")
          ]
        ]
      )
      |> Repo.update_all([])

    case count do
      1 -> {:ok, "Widget configuration updated successfully"}
      0 -> {:error, "No widget configuration found with the provided IDs"}
      _ -> {:error, "Unexpected number of records updated"}
    end
  end

  def get_widget_config(playlist_id, playlist_item_id) do
    from(wc in WidgetConfig,
      join: pi in assoc(wc, :playlist_item),
      where: pi.playlist_id == ^playlist_id and pi.id == ^playlist_item_id,
      select: wc
    )
    |> Repo.one()
  end

  @doc """
  Creates a widget.

  ## Examples

      iex> create_widget(%{field: value})
      {:ok, %Widget{}}

      iex> create_widget(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_widget(attrs \\ %{}) do
    %Widget{}
    |> Widget.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a widget.

  ## Examples

      iex> update_widget(widget, %{field: new_value})
      {:ok, %Widget{}}

      iex> update_widget(widget, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_widget(%Widget{} = widget, attrs) do
    widget
    |> Widget.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a widget.

  ## Examples

      iex> delete_widget(widget)
      {:ok, %Widget{}}

      iex> delete_widget(widget)
      {:error, %Ecto.Changeset{}}

  """
  def delete_widget(%Widget{} = widget) do
    Repo.delete(widget)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking widget changes.

  ## Examples

      iex> change_widget(widget)
      %Ecto.Changeset{data: %Widget{}}

  """
  def change_widget(%Widget{} = widget, attrs \\ %{}) do
    Widget.changeset(widget, attrs)
  end
end
