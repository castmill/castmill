defmodule Castmill.Widgets do
  @moduledoc """
  The Widgets context.
  """
  import Ecto.Query, warn: false
  require Logger

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

  If the widget has an integration definition in its meta field, this function
  also ensures the integration record exists (creates it if needed).

  TODO:
  The data should be fetched from the widgets webhook endpoint, so a new widget instance will always have
  some valid data.

  We would possible like to encrypt this data before storing it in the database with a key that is unique
  for the organization that owns the widget instance.

  ## Examples

      iex> new_widget_config("w_id", "pii_id", %{ "foo" => "bar" })
      %WidgetConfig{}
  """
  def new_widget_config(widget_id, playlist_item_id, options, data \\ nil, opts \\ []) do
    # First ensure the integration exists if the widget has one defined
    widget = get_widget(widget_id)
    organization_id = Keyword.get(opts, :organization_id)

    Logger.debug("new_widget_config: widget_id=#{widget_id}, org_id=#{inspect(organization_id)}")

    integration =
      if widget do
        # Ensure integration exists for widgets with integration definitions
        case Castmill.Widgets.Integrations.ensure_integration_for_widget(widget) do
          {:ok, integration} ->
            Logger.debug(
              "new_widget_config: Found integration #{inspect(integration && integration.id)}"
            )

            integration

          other ->
            Logger.debug(
              "new_widget_config: ensure_integration_for_widget returned #{inspect(other)}"
            )

            nil
        end
      else
        Logger.debug("new_widget_config: Widget not found")
        nil
      end

    # Create the widget config
    result =
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

    # Schedule polling for auth-free integrations (like RSS)
    with {:ok, _widget_config} <- result,
         %Castmill.Widgets.Integrations.WidgetIntegration{} = int <- integration,
         true <- is_auth_free_integration?(int),
         org_id when not is_nil(org_id) <- organization_id do
      Logger.info("new_widget_config: Scheduling polling for auth-free integration #{int.id}")
      schedule_auth_free_polling(org_id, widget_id, int, options)
    else
      other ->
        Logger.debug(
          "new_widget_config: Skipping schedule, with clause failed: #{inspect(other)}"
        )

        other
    end

    result
  end

  defp is_auth_free_integration?(%Castmill.Widgets.Integrations.WidgetIntegration{} = integration) do
    # Check if the integration requires no authentication
    auth_type =
      get_in(integration.pull_config, ["auth_type"]) ||
        get_in(integration.credential_schema, ["auth_type"])

    auth_type == "none"
  end

  defp schedule_auth_free_polling(organization_id, widget_id, integration, widget_options) do
    # Build discriminator ID based on integration type
    discriminator_id = build_discriminator_id(integration, widget_options)

    Logger.info(
      "Scheduling auth-free polling for widget #{widget_id}, org #{organization_id}, discriminator: #{discriminator_id}"
    )

    # Spawn a separate process to schedule the poll, so that:
    # 1. It doesn't block the database transaction
    # 2. If Redis isn't available, it doesn't crash the transaction
    Task.start(fn ->
      try do
        result =
          Castmill.Workers.IntegrationPoller.schedule_poll(%{
            organization_id: organization_id,
            widget_id: widget_id,
            integration_id: integration.id,
            discriminator_id: discriminator_id,
            widget_options: widget_options
          })

        Logger.info("Schedule poll result: #{inspect(result)}")
      rescue
        e ->
          Logger.warning("Failed to schedule auth-free polling: #{inspect(e)}")
      catch
        :exit, reason ->
          Logger.warning("Failed to schedule auth-free polling (exit): #{inspect(reason)}")
      end
    end)
  end

  defp build_discriminator_id(integration, widget_options) do
    # For widget_option discriminators, also check pull_config for hardcoded values
    # (e.g., RSS widgets have feed_url in pull_config, not in widget_options)
    pull_config = integration.pull_config || %{}
    merged_options = Map.merge(pull_config, widget_options || %{})

    case integration.discriminator_type do
      "widget_option" ->
        key = integration.discriminator_key || "id"

        value =
          Map.get(merged_options, key) || Map.get(merged_options, String.to_atom(key)) ||
            "default"

        "#{key}:#{value}"

      "organization" ->
        "org"

      _ ->
        # widget_config or default
        "default"
    end
  end

  def get_widget_by_slug(slug) do
    Widget
    |> where([w], w.slug == ^slug)
    |> Repo.one()
  end

  @doc """
  Gets the usage information for a widget, including all playlists where it is used.

  Returns a list of maps containing:
  - playlist_id: The ID of the playlist using this widget
  - playlist_name: The name of the playlist
  - playlist_item_id: The ID of the playlist item containing this widget
  - widget_config_id: The ID of the widget configuration

  ## Examples

      iex> get_widget_usage(123)
      [%{playlist_id: 1, playlist_name: "My Playlist", playlist_item_id: "uuid", widget_config_id: "uuid"}]

      iex> get_widget_usage(999)
      []
  """
  def get_widget_usage(widget_id) do
    from(wc in WidgetConfig,
      join: pi in assoc(wc, :playlist_item),
      join: p in assoc(pi, :playlist),
      where: wc.widget_id == ^widget_id,
      select: %{
        playlist_id: p.id,
        playlist_name: p.name,
        playlist_item_id: pi.id,
        widget_config_id: wc.id
      }
    )
    |> Repo.all()
  end

  @doc """
  Deletes a widget and all its associated widget_configs.

  This function first removes all widget_configs that reference the widget,
  then deletes the widget itself.

  ## Examples

      iex> delete_widget_with_cascade(widget)
      {:ok, %Widget{}}

      iex> delete_widget_with_cascade(widget_not_found)
      {:error, :widget_not_found}
  """
  def delete_widget_with_cascade(%Widget{} = widget) do
    Repo.transaction(fn ->
      # First, delete all widget_configs referencing this widget
      from(wc in WidgetConfig, where: wc.widget_id == ^widget.id)
      |> Repo.delete_all()

      # Then delete the widget itself
      case Repo.delete(widget) do
        {:ok, deleted_widget} -> deleted_widget
        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
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
      is_nil(credential_schema) ->
        false

      # Empty map
      credential_schema == %{} ->
        false

      # "optional" or "none" auth_type means credentials are not required upfront
      # (e.g., RSS feeds that work without auth)
      Map.get(credential_schema, "auth_type") in ["optional", "none"] ->
        false

      # Has required auth_type (e.g., "oauth2", "api_key", "basic")
      Map.has_key?(credential_schema, "auth_type") ->
        true

      # Has fields with at least one required field
      Map.has_key?(credential_schema, "fields") &&
          has_required_fields?(credential_schema["fields"]) ->
        true

      # Otherwise, doesn't require credentials
      true ->
        false
    end
  end

  # Checks if any field in the credential schema is required
  defp has_required_fields?(nil), do: false
  defp has_required_fields?(fields) when fields == %{}, do: false

  defp has_required_fields?(fields) when is_map(fields) do
    Enum.any?(fields, fn {_key, field_def} ->
      is_map(field_def) && Map.get(field_def, "required", false) == true
    end)
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
    widget && widget.slug in ["layout-widget"]
  end

  defp extract_playlist_references(options) when is_map(options) do
    # New Layout Widget stores playlist references in layoutRef.zonePlaylistMap
    # Format: %{"layoutRef" => %{"zonePlaylistMap" => %{"zone-id" => %{"playlistId" => 123}, ...}}}
    case get_in(options, ["layoutRef", "zonePlaylistMap"]) do
      zone_map when is_map(zone_map) ->
        zone_map
        |> Map.values()
        |> Enum.map(fn
          # Handle the correct format: %{"playlistId" => id}
          %{"playlistId" => id} when is_integer(id) ->
            id

          %{"playlistId" => id} when is_binary(id) ->
            case Integer.parse(id) do
              {int_id, ""} -> int_id
              _ -> nil
            end

          # Handle direct integer (legacy/simplified format)
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

      _ ->
        []
    end
  end

  defp extract_playlist_references(_), do: []

  @doc """
  Gets a widget config by its ID.
  """
  def get_widget_config_by_id(widget_config_id) do
    Repo.get(WidgetConfig, widget_config_id)
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
