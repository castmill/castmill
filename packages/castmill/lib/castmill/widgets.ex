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
    # First, check for circular references if this is a layout widget with playlist references
    with :ok <- validate_playlist_references(playlist_id, playlist_item_id, options) do
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
  end

  @doc """
  Validates that playlist references in layout widgets don't create circular references.
  This is the public entry point for validation before a playlist item is created.

  Returns :ok if validation passes, or {:error, :circular_reference} if it would create a cycle.
  """
  def validate_playlist_references_for_widget(widget_id, playlist_id, options) do
    widget = get_widget(widget_id)

    if widget && is_layout_widget?(widget) do
      # Extract playlist IDs from options
      playlist_refs = extract_playlist_references(options)

      # Validate each playlist reference
      Enum.reduce_while(playlist_refs, :ok, fn ref_playlist_id, _acc ->
        case Castmill.Resources.validate_no_circular_reference(playlist_id, ref_playlist_id) do
          :ok -> {:cont, :ok}
          {:error, :circular_reference} -> {:halt, {:error, :circular_reference}}
        end
      end)
    else
      :ok
    end
  end

  @doc """
  Validates that a widget's required integration credentials are configured for the organization.

  Widgets with integrations that have a non-empty credential_schema require credentials
  to be configured at the organization level before they can be added to a playlist.

  Returns :ok if validation passes, or {:error, :missing_integration_credentials} if
  credentials are required but not configured.

  ## Parameters
    - widget_id: The ID of the widget to validate
    - organization_id: The organization ID to check credentials for

  ## Examples

      iex> validate_integration_credentials_for_widget("spotify-now-playing", "org-123")
      :ok

      iex> validate_integration_credentials_for_widget("spotify-now-playing", "org-without-creds")
      {:error, :missing_integration_credentials}
  """
  def validate_integration_credentials_for_widget(widget_id, organization_id) do
    alias Castmill.Widgets.Integrations

    # Get all integrations for this widget
    integrations = Integrations.list_integrations(widget_id: widget_id)

    # Check each integration that requires credentials
    Enum.reduce_while(integrations, :ok, fn integration, _acc ->
      if integration_requires_credentials?(integration) do
        # Check if credentials exist for this organization
        case Integrations.get_credentials_by_scope(integration.id,
               organization_id: organization_id
             ) do
          nil -> {:halt, {:error, :missing_integration_credentials}}
          _credential -> {:cont, :ok}
        end
      else
        {:cont, :ok}
      end
    end)
  end

  # Checks if an integration requires credentials based on its credential_schema
  defp integration_requires_credentials?(integration) do
    credential_schema = integration.credential_schema

    cond do
      # No credential schema at all
      is_nil(credential_schema) -> false
      # Empty map
      credential_schema == %{} -> false
      # Has auth_type or fields defined
      Map.has_key?(credential_schema, "auth_type") -> true
      Map.has_key?(credential_schema, "fields") && credential_schema["fields"] != %{} -> true
      # Otherwise, doesn't require credentials
      true -> false
    end
  end

  # Validates that playlist references in layout widgets don't create circular references
  # This version is used for updating existing widget configs
  defp validate_playlist_references(playlist_id, playlist_item_id, options) do
    # Get the widget config to check if it's a layout widget
    widget_config = get_widget_config_with_widget(playlist_id, playlist_item_id)

    if widget_config && is_layout_widget?(widget_config.widget) do
      # Extract playlist IDs from options
      playlist_refs = extract_playlist_references(options)

      # Validate each playlist reference
      Enum.reduce_while(playlist_refs, :ok, fn ref_playlist_id, _acc ->
        case Castmill.Resources.validate_no_circular_reference(playlist_id, ref_playlist_id) do
          :ok -> {:cont, :ok}
          {:error, :circular_reference} -> {:halt, {:error, :circular_reference}}
        end
      end)
    else
      :ok
    end
  end

  defp get_widget_config_with_widget(playlist_id, playlist_item_id) do
    from(wc in WidgetConfig,
      join: pi in assoc(wc, :playlist_item),
      join: w in assoc(wc, :widget),
      where: pi.playlist_id == ^playlist_id and pi.id == ^playlist_item_id,
      preload: [widget: w]
    )
    |> Repo.one()
  end

  defp is_layout_widget?(widget) do
    widget && widget.slug in ["layout-portrait-3"]
  end

  defp extract_playlist_references(options) when is_map(options) do
    # Layout widgets store playlist references as playlist_1, playlist_2, playlist_3
    ["playlist_1", "playlist_2", "playlist_3"]
    |> Enum.map(&Map.get(options, &1))
    |> Enum.filter(&(&1 != nil))
    |> Enum.map(fn
      id when is_integer(id) ->
        id

      id when is_binary(id) ->
        case Integer.parse(id) do
          {int_id, ""} -> int_id
          _ -> nil
        end

      _ ->
        nil
    end)
    |> Enum.filter(&(&1 != nil))
  end

  defp extract_playlist_references(_), do: []

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

  @doc """
  Gets the organization ID for a widget config.

  Traces through: WidgetConfig -> PlaylistItem -> Playlist -> Organization

  Returns `nil` if the widget config doesn't exist or isn't linked to a playlist.

  ## Examples

      iex> get_organization_id_for_widget_config("config-uuid")
      "org-uuid"

      iex> get_organization_id_for_widget_config("nonexistent")
      nil
  """
  def get_organization_id_for_widget_config(widget_config_id) do
    # Validate that widget_config_id is a valid UUID before querying
    # Some older widget configs have integer IDs which won't work with integrations
    case Ecto.UUID.cast(widget_config_id) do
      {:ok, _uuid} ->
        query =
          from wc in WidgetConfig,
            join: pi in assoc(wc, :playlist_item),
            join: p in assoc(pi, :playlist),
            where: wc.id == ^widget_config_id,
            select: p.organization_id

        Repo.one(query)

      :error ->
        # Not a valid UUID (e.g., integer ID from older widget configs)
        nil
    end
  end

  @doc """
  Gets the widget ID for a given widget config.

  Returns `nil` if the widget config doesn't exist.

  ## Examples

      iex> get_widget_id_for_config("config-uuid")
      7

      iex> get_widget_id_for_config("nonexistent")
      nil
  """
  def get_widget_id_for_config(widget_config_id) do
    case Ecto.UUID.cast(widget_config_id) do
      {:ok, _uuid} ->
        query =
          from wc in WidgetConfig,
            where: wc.id == ^widget_config_id,
            select: wc.widget_id

        Repo.one(query)

      :error ->
        nil
    end
  end
end
