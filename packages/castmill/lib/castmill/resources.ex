defmodule Castmill.Resources do
  @moduledoc """
  The Resources context.

  This context handles all operations related to resources that are owned by an organization,
  such as:
  - Medias
  - Playlists
  - Widgets
  - Caledars
  """
  import Ecto.Query, warn: false
  alias Castmill.Repo

  alias Castmill.Resources.Media
  alias Castmill.Resources.Playlist
  alias Castmill.Resources.Layout
  alias Castmill.Resources.PlaylistItem
  alias Castmill.Resources.Channel
  alias Castmill.Resources.ChannelEntry

  alias Castmill.Devices.Device

  alias Castmill.Organizations.Organization

  alias Castmill.Protocol.Access
  alias Castmill.QueryHelpers

  alias Castmill.Files.FilesMedias

  @doc """
    Can access the resource.
    User can only access a resource if he has access to the organization that owns the resource
    and has the right access level.

    Access level is defined when adding a user to an organization via the organization_users table.
  """
  def canAccessResource(resource, user, action) do
    if is_nil(user) do
      {:error, "No user provided"}
    else
      # Determine if the user has access to the media that belongs to the organization
      organization_id = resource.organization_id

      ou =
        Repo.get_by(Castmill.Organizations.OrganizationsUsers,
          organization_id: organization_id,
          user_id: user.id
        )

      type = Castmill.Protocol.Resource.type(resource)

      if ou !== nil && ou.access in "#{type}:#{action}" do
        {:ok, true}
      else
        # Not sure yet if we should test if use has access to this media through a team
        # or if we should have another access protocol for teams :/
        {:ok, false}
      end
    end
  end

  defimpl Access, for: Media do
    def canAccess(resource, user, action) do
      Castmill.Resources.canAccessResource(resource, user, action)
    end
  end

  defimpl Access, for: Playlist do
    def canAccess(resource, user, action) do
      Castmill.Resources.canAccessResource(resource, user, action)
    end
  end

  defimpl Access, for: Channel do
    def canAccess(resource, user, action) do
      Castmill.Resources.canAccessResource(resource, user, action)
    end
  end

  defimpl Access, for: Layout do
    def canAccess(resource, user, action) do
      Castmill.Resources.canAccessResource(resource, user, action)
    end
  end

  # defimpl Access, for: Device do
  #  def canAccess(resource, user, action) do
  #    Castmill.Resources.canAccessResource(resource, user, action)
  #  end
  # end

  alias Castmill.Protocol.Resource

  defimpl Resource, for: Media do
    def type(_value), do: "media"
  end

  defimpl Resource, for: Playlist do
    def type(_value), do: "playlist"
  end

  defimpl Resource, for: Channel do
    def type(_value), do: "channel"
  end

  defimpl Resource, for: Layout do
    def type(_value), do: "layout"
  end

  defimpl Resource, for: Device do
    def type(_value), do: "device"
  end

  # Quota enforcement helper functions
  defp check_resource_quota(organization_id, schema_module, resource_type) do
    current_count = get_quota_used_for_organization(organization_id, schema_module)
    max_quota = Castmill.Quotas.get_quota_for_organization(organization_id, resource_type)

    if current_count < max_quota do
      :ok
    else
      {:error, :quota_exceeded}
    end
  end

  defp get_quota_used_for_organization(organization_id, schema_module) do
    from(r in schema_module,
      where: r.organization_id == ^organization_id,
      select: count(r.id)
    )
    |> Repo.one()
  end

  @doc """
  Creates a playlist
  """
  def create_playlist(attrs \\ %{}) do
    organization_id = Map.get(attrs, "organization_id") || Map.get(attrs, :organization_id)

    # Check quota before creating the playlist
    with :ok <- check_resource_quota(organization_id, Playlist, :playlists) do
      %Playlist{}
      |> Playlist.changeset(attrs)
      |> Repo.insert()
    else
      {:error, :quota_exceeded} -> {:error, :quota_exceeded}
    end
  end

  @doc """
    Gets a playlist
  """
  def get_playlist(id) do
    playlist =
      Playlist
      |> where(id: ^id)
      |> Repo.one()

    if is_nil(playlist) do
      nil
    else
      items =
        get_playlist_items(id)
        |> Enum.map(&transform_item(&1, playlist.organization_id))

      %{playlist | items: items}
    end
  end

  defp transform_item(item, organization_id) do
    # Resolve widget references (media, playlist refs, etc.) and merge them into options
    # resolve_widget_references only returns the resolved ref fields, so we merge them
    # back into the original options to preserve all other option values
    original_options = item.widget_config.options || %{}

    resolved_refs =
      resolve_widget_references(
        item.widget_config.widget.options_schema || %{},
        original_options
      )

    merged_options = Map.merge(original_options, resolved_refs)

    # Drop the :widget key from widget_config
    modified_widget_config = Map.drop(item.widget_config, [:widget])

    # Put the merged options into modified_widget_config
    modified_widget_config_with_resolved_options =
      Map.put(modified_widget_config, :options, merged_options)

    # Apply defaults from data_schema to ensure all fields have values
    # This is important for widgets like Spotify Now Playing that rely on default values
    data_with_defaults =
      apply_data_schema_defaults(
        item.widget_config.widget.data_schema || %{},
        Map.get(modified_widget_config_with_resolved_options, :data, %{}) || %{}
      )

    modified_widget_config_with_defaults =
      Map.put(modified_widget_config_with_resolved_options, :data, data_with_defaults)

    # Fetch integration data if available and merge into config.data
    # This makes integration data available to the player template system
    # which resolves bindings like {key: "data.field_name"}
    #
    # Strategy:
    # 1. First try widget-config-specific data
    # 2. Try discriminator-based data (e.g., widgets with same symbols share data)
    # 3. Fall back to organization-level shared data (e.g., all Spotify widgets
    #    in an org share the same "Now Playing" data)
    # 4. If no data found, trigger on-demand fetch for PULL integrations
    #
    # Extract widget_options here so it can be used both for looking up integration data
    # and for filtering max_items when serving data to each widget instance
    widget_options_for_filtering = modified_widget_config_with_defaults.options || %{}

    integration_data =
      case Castmill.Widgets.Integrations.get_integration_data_by_config(item.widget_config.id) do
        %Castmill.Widgets.Integrations.WidgetIntegrationData{} = data ->
          {:ok, data}

        nil ->
          # Try discriminator-based lookup using widget options
          widget_id = item.widget_config.widget.id

          case Castmill.Widgets.Integrations.get_integration_data_for_widget_with_options(
                 organization_id,
                 widget_id,
                 widget_options_for_filtering
               ) do
            %Castmill.Widgets.Integrations.WidgetIntegrationData{} = data ->
              {:ok, data}

            nil ->
              # No cached data - try on-demand fetch for PULL integrations
              try_on_demand_fetch_for_item(
                organization_id,
                item.widget_config.id,
                widget_id,
                widget_options_for_filtering
              )
          end
      end

    # Handle integration data result, tracking any errors
    {modified_widget_config_with_integration, integration_error} =
      case integration_data do
        {:ok, %Castmill.Widgets.Integrations.WidgetIntegrationData{} = data} ->
          # Merge integration data into the existing data field (overrides defaults)
          existing_data = Map.get(modified_widget_config_with_defaults, :data, %{}) || %{}
          merged_data = Map.merge(existing_data, data.data || %{})

          # Apply max_items filtering if the data has an "items" array
          # This allows each widget instance to have its own max_items setting
          # while sharing the same cached data
          filtered_data = apply_max_items_filter(merged_data, widget_options_for_filtering)
          {Map.put(modified_widget_config_with_defaults, :data, filtered_data), nil}

        {:error, reason} ->
          # Fetch failed - return defaults but track the error
          {modified_widget_config_with_defaults, format_integration_error(reason)}

        nil ->
          {modified_widget_config_with_defaults, nil}
      end

    # Take required fields from item and merge the modified widget data and other info
    result =
      item
      |> Map.take([:id, :duration, :offset, :inserted_at, :updated_at])
      |> Map.merge(%{
        config: modified_widget_config_with_integration,
        widget: item.widget_config.widget
      })

    # Add integration_error field if there was an error fetching data
    if integration_error do
      Map.put(result, :integration_error, integration_error)
    else
      result
    end
  end

  # Default max_items to use when not explicitly set in widget options
  @default_max_items 10

  # Apply max_items filtering to data containing an "items" array.
  # This allows each widget instance to have its own max_items setting
  # while sharing the same cached data (which may contain more items).
  # Items are assumed to be already sorted by date (newest first) from the fetcher.
  defp apply_max_items_filter(data, widget_options) when is_map(data) do
    # Get max_items from widget options, falling back to default
    max_items =
      Map.get(widget_options, "max_items") ||
        Map.get(widget_options, :max_items) ||
        @default_max_items

    items = Map.get(data, "items")

    cond do
      is_nil(items) ->
        # No items array - return as-is
        data

      is_list(items) and is_integer(max_items) and max_items > 0 ->
        # Filter to max_items
        filtered_items = Enum.take(items, max_items)
        Map.put(data, "items", filtered_items)

      true ->
        data
    end
  end

  defp apply_max_items_filter(data, _widget_options), do: data

  # Format integration error reason into a user-friendly message
  defp format_integration_error(:unknown_feed_format),
    do: "Invalid feed format - URL is not a valid RSS/Atom feed"

  defp format_integration_error(:invalid_url), do: "Invalid URL"
  defp format_integration_error(:not_found), do: "Feed not found (404)"
  defp format_integration_error(:forbidden), do: "Access denied (403)"
  defp format_integration_error(:unauthorized), do: "Authentication required"
  defp format_integration_error(:no_credentials), do: "Credentials not configured"
  defp format_integration_error(:storage_failed), do: "Failed to store fetched data"
  defp format_integration_error(:timeout), do: "Request timed out"
  defp format_integration_error(reason) when is_atom(reason), do: "Fetch failed: #{reason}"
  defp format_integration_error(reason) when is_binary(reason), do: reason
  defp format_integration_error(_reason), do: "Unknown error"

  # Apply default values from data_schema to the data map
  defp apply_data_schema_defaults(data_schema, data) do
    Enum.reduce(data_schema, data, fn {key, schema_def}, acc ->
      case Map.get(acc, key) do
        nil ->
          # Field not set, apply default if available
          case Map.get(schema_def, "default") do
            nil -> acc
            default -> Map.put(acc, key, default)
          end

        _ ->
          # Field already has a value
          acc
      end
    end)
  end

  # Attempts to fetch data on-demand for PULL integrations when no cached data exists
  # This is called from transform_item to ensure widgets show real data on first load
  defp try_on_demand_fetch_for_item(organization_id, _widget_config_id, widget_id, widget_options) do
    alias Castmill.Widgets.Integrations

    # Get the widget's integration
    case Integrations.list_integrations(widget_id: widget_id) do
      [] ->
        nil

      [integration | _] ->
        # Only handle PULL integrations with fetcher modules
        if integration.integration_type == "pull" do
          pull_config = integration.pull_config || %{}
          credential_schema = integration.credential_schema || %{}
          fetcher_module_name = Map.get(pull_config, "fetcher_module")

          if fetcher_module_name do
            # Get credentials or use empty map for optional auth
            # auth_type can be in pull_config or credential_schema
            auth_type =
              Map.get(pull_config, "auth_type") ||
                Map.get(credential_schema, "auth_type") ||
                "required"

            credentials =
              case Integrations.get_organization_credentials(organization_id, integration.id) do
                {:ok, creds} -> creds
                {:error, _} when auth_type in ["optional", "none"] -> %{}
                {:error, _} -> nil
              end

            if credentials do
              # Try to fetch data using the fetcher
              case fetch_with_module(fetcher_module_name, credentials, widget_options) do
                {:ok, data, _creds} ->
                  # Store the data and return it
                  discriminator_id = build_discriminator_id(integration, widget_options)

                  case Integrations.upsert_integration_data(%{
                         widget_integration_id: integration.id,
                         organization_id: organization_id,
                         discriminator_id: discriminator_id,
                         data: data,
                         status: "active",
                         fetched_at: DateTime.utc_now(),
                         version: :os.system_time(:second)
                       }) do
                    {:ok, integration_data} ->
                      {:ok, integration_data}

                    {:error, _reason} ->
                      {:error, :storage_failed}
                  end

                {:error, reason, _creds} ->
                  # 3-tuple error format (returned by some fetchers with credentials)
                  {:error, reason}

                {:error, reason} ->
                  # 2-tuple error format
                  {:error, reason}
              end
            else
              {:error, :no_credentials}
            end
          else
            nil
          end
        else
          nil
        end
    end
  end

  defp fetch_with_module(module_name, credentials, options) when is_binary(module_name) do
    allowed_prefixes = [
      "Castmill.Widgets.Integrations.Fetchers.",
      "Elixir.Castmill.Widgets.Integrations.Fetchers."
    ]

    if Enum.any?(allowed_prefixes, &String.starts_with?(module_name, &1)) do
      try do
        full_module_name =
          if String.starts_with?(module_name, "Elixir.") do
            module_name
          else
            "Elixir.#{module_name}"
          end

        module = String.to_existing_atom(full_module_name)
        module.fetch(credentials, options)
      rescue
        ArgumentError ->
          {:error, :invalid_fetcher_module}
      end
    else
      {:error, :unauthorized_module}
    end
  end

  defp build_discriminator_id(integration, options) do
    case integration.discriminator_type do
      "widget_option" ->
        key = integration.discriminator_key || "id"
        value = Map.get(options, key) || Map.get(options, String.to_atom(key)) || "default"
        "#{key}:#{value}"

      _ ->
        "default"
    end
  end

  defp resolve_widget_references(schema, data) do
    Enum.reduce(schema, %{}, fn {key, value}, acc ->
      case value do
        %{"type" => "ref", "collection" => collection} ->
          # Take the collection name and ignore the filter
          [collection_name | _] = String.split(collection, "|")
          fetched_data = fetch_widget_reference(data, key, collection_name)
          Map.put(acc, key, fetched_data)

        _ ->
          acc
      end
    end)
  end

  defp fetch_widget_reference(data, key, "medias") do
    case Map.get(data, key) do
      nil -> nil
      "" -> nil
      media_id -> get_media(media_id)
    end
  end

  defp fetch_widget_reference(data, key, "playlists") do
    case Map.get(data, key) do
      nil -> nil
      "" -> nil
      # Fetch full playlist with items for player
      playlist_id -> get_playlist(playlist_id)
    end
  end

  @doc """
  Get basic playlist info without items (to avoid circular references).
  Used when resolving playlist references in layout widgets.
  """
  def get_playlist_basic(id) do
    Repo.get(Playlist, id)
  end

  @doc """
  Update a resource
  """
  def update(%Playlist{} = playlist, attrs) do
    playlist
    |> Playlist.changeset(attrs)
    |> Repo.update()
  end

  def update(%Media{} = media, attrs) do
    media
    |> Media.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Checks if a playlist is used in any channels (as default playlist or in channel entries).
  """
  def playlist_has_channels?(%Playlist{id: playlist_id}) do
    playlist_has_channels?(playlist_id)
  end

  def playlist_has_channels?(playlist_id) when is_integer(playlist_id) do
    now = DateTime.utc_now()

    # Check if used as default playlist
    default_playlist_query =
      from(c in Channel,
        where: c.default_playlist_id == ^playlist_id,
        select: count(c.id)
      )

    # Check if used in future/ongoing channel entries
    # Only consider entries that end in the future or have future repeats
    channel_entry_query =
      from(ce in ChannelEntry,
        where:
          ce.playlist_id == ^playlist_id and
            (ce.end > ^now or
               (not is_nil(ce.repeat_weekly_until) and
                  ce.repeat_weekly_until >= ^NaiveDateTime.to_date(now))),
        select: count(ce.id)
      )

    default_count = Repo.one(default_playlist_query)
    entry_count = Repo.one(channel_entry_query)

    default_count + entry_count > 0
  end

  @doc """
  Gets the channels that are using a specific playlist.
  Returns a list of maps with channel id, name, usage type, and entry details if applicable.
  Only considers future or ongoing channel entries (ignores past entries).
  """
  def get_channels_using_playlist(playlist_id) when is_integer(playlist_id) do
    now = DateTime.utc_now()

    # Get channels where playlist is the default playlist
    default_playlist_channels =
      from(c in Channel,
        where: c.default_playlist_id == ^playlist_id,
        select: %{
          id: c.id,
          name: c.name,
          usage_type: "default",
          entry_start: fragment("NULL"),
          entry_end: fragment("NULL"),
          repeat_until: fragment("NULL")
        }
      )
      |> Repo.all()

    # Get channels where playlist is used in future/ongoing channel entries
    # An entry is considered active if:
    # 1. It ends in the future (entry.end > now), OR
    # 2. It has a repeat_weekly_until date in the future
    channel_entry_channels =
      from(ce in ChannelEntry,
        join: c in Channel,
        on: ce.channel_id == c.id,
        where:
          ce.playlist_id == ^playlist_id and
            (ce.end > ^now or
               (not is_nil(ce.repeat_weekly_until) and
                  ce.repeat_weekly_until >= ^NaiveDateTime.to_date(now))),
        distinct: true,
        select: %{
          id: c.id,
          name: c.name,
          usage_type: "scheduled",
          entry_start: ce.start,
          entry_end: ce.end,
          repeat_until: ce.repeat_weekly_until
        }
      )
      |> Repo.all()

    # Combine results (no need to remove duplicates as they have different usage_type)
    default_playlist_channels ++ channel_entry_channels
  end

  @doc """
    Removes a playlist.
    Returns {:error, :playlist_has_channels} if the playlist is used in any channels.
  """
  def delete_playlist(%Playlist{} = playlist) do
    if playlist_has_channels?(playlist) do
      {:error, :playlist_has_channels}
    else
      Repo.delete(playlist)
    end
  end

  @doc """
  Gets all ancestor playlist IDs for a given playlist.
  An ancestor is a playlist that contains the given playlist (directly or indirectly)
  through layout widgets that reference playlists.

  This is used to prevent circular references when configuring layout widgets.
  """
  def get_playlist_ancestors(playlist_id) when is_integer(playlist_id) do
    get_playlist_ancestors_recursive(playlist_id, MapSet.new(), MapSet.new())
    |> MapSet.to_list()
  end

  defp get_playlist_ancestors_recursive(playlist_id, visited, ancestors) do
    if MapSet.member?(visited, playlist_id) do
      # Already processed this playlist, return current ancestors
      ancestors
    else
      # Mark this playlist as visited
      new_visited = MapSet.put(visited, playlist_id)

      # Find all playlists that contain this playlist through their widget configs
      # Layout widgets store playlist references in their options as playlist_1, playlist_2, playlist_3
      parent_playlist_ids = get_direct_parent_playlists(playlist_id)

      # Recursively find ancestors of each parent
      Enum.reduce(parent_playlist_ids, ancestors, fn parent_id, acc ->
        # Add parent to ancestors
        updated_ancestors = MapSet.put(acc, parent_id)
        # Recurse to find parent's ancestors
        get_playlist_ancestors_recursive(parent_id, new_visited, updated_ancestors)
      end)
    end
  end

  defp get_direct_parent_playlists(playlist_id) do
    # Query for playlist items that have widget configs with this playlist_id in their options
    # New Layout Widget stores playlist references in options.layoutRef.zonePlaylistMap
    # Format: {"layoutRef": {"zonePlaylistMap": {"zone-id": {"playlistId": 123}, ...}}}
    # We need to find all playlists that contain items referencing our playlist_id

    # Using JSONB query to check if playlist_id exists in zonePlaylistMap values
    # Each zone value is an object with playlistId field
    query =
      from(pi in PlaylistItem,
        join: wc in assoc(pi, :widget_config),
        join: w in assoc(wc, :widget),
        # Layout widgets that reference playlists via layoutRef.zonePlaylistMap
        where:
          w.slug == "layout-widget" and
            fragment(
              "EXISTS (SELECT 1 FROM jsonb_each(?->'layoutRef'->'zonePlaylistMap') AS kv WHERE (kv.value->>'playlistId')::integer = ?)",
              wc.options,
              ^playlist_id
            ),
        select: pi.playlist_id,
        distinct: true
      )

    Repo.all(query)
  end

  @doc """
  Validates that selecting a playlist would not create a circular reference.
  Returns :ok if valid, or {:error, :circular_reference} if it would create a cycle.

  A circular reference would occur if:
  1. The current playlist tries to reference itself
  2. The selected playlist is already an ancestor of the current playlist
     (meaning the current playlist is already contained within the selected playlist,
      so adding selected as a child would create: selected -> ... -> current -> selected)

  ## Parameters
    - current_playlist_id: The playlist where the layout widget is being configured
    - selected_playlist_id: The playlist being selected for the layout widget
  """
  def validate_no_circular_reference(current_playlist_id, selected_playlist_id) do
    # Ensure both IDs are integers
    current_id = to_integer(current_playlist_id)
    selected_id = to_integer(selected_playlist_id)

    cond do
      # Can't select the same playlist
      current_id == selected_id ->
        {:error, :circular_reference}

      # Check if selected playlist is an ancestor of current playlist
      # If so, adding selected as child would create: selected -> ... -> current -> selected
      selected_id in get_playlist_ancestors(current_id) ->
        {:error, :circular_reference}

      true ->
        :ok
    end
  end

  # Helper to convert string or integer to integer
  defp to_integer(id) when is_integer(id), do: id

  defp to_integer(id) when is_binary(id) do
    case Integer.parse(id) do
      {int_id, ""} -> int_id
      _ -> raise ArgumentError, "Invalid playlist ID: #{id}"
    end
  end

  # ==========================================================================
  # Layout CRUD Operations
  # ==========================================================================

  @doc """
  Creates a layout.
  """
  def create_layout(attrs \\ %{}) do
    organization_id = Map.get(attrs, "organization_id") || Map.get(attrs, :organization_id)

    # Check quota before creating the layout
    with :ok <- check_resource_quota(organization_id, Layout, :layouts) do
      %Layout{}
      |> Layout.changeset(attrs)
      |> Repo.insert()
    else
      {:error, :quota_exceeded} -> {:error, :quota_exceeded}
    end
  end

  @doc """
  Gets a layout by ID.
  """
  def get_layout(id) do
    Repo.get(Layout, id)
  end

  @doc """
  Gets a layout by ID, raises if not found.
  """
  def get_layout!(id) do
    Repo.get!(Layout, id)
  end

  @doc """
  Updates a layout.
  """
  def update_layout(%Layout{} = layout, attrs) do
    layout
    |> Layout.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a layout.
  """
  def delete_layout(%Layout{} = layout) do
    Repo.delete(layout)
  end

  @doc """
  Returns a layout in player format (for widget usage).
  """
  def get_layout_for_player(layout_id) do
    case get_layout(layout_id) do
      nil -> nil
      layout -> Layout.to_player_format(layout)
    end
  end

  # ==========================================================================
  # Playlist Item Operations
  # ==========================================================================

  @doc """
    Creates a Playlist item
  """
  def create_playlist_item(attrs \\ %{}) do
    %PlaylistItem{}
    |> PlaylistItem.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
    Update a Playlist item
  """
  def update_playlist_item(%PlaylistItem{} = playlist_item, attrs) do
    playlist_item
    |> PlaylistItem.changeset(attrs)
    |> Repo.update()
  end

  @doc """
   Inserts an item in a given position of a playlist. The item will be placed after the given item or at the
   beginning of the list if nil is passed as the prev_item_id.

   The options passed must conform with the widget's schema, or an error will be returned.

   For layout widgets, validates that the playlist references don't create circular references.
   For widgets with integrations, validates that required credentials are configured.
  """
  def insert_item_into_playlist(
        playlist_id,
        prev_item_id,
        widget_id,
        offset,
        duration,
        options \\ %{}
      ) do
    Repo.transaction(fn ->
      # First, get the playlist to access its organization_id
      playlist = Repo.get(Playlist, playlist_id)

      if is_nil(playlist) do
        Repo.rollback("Playlist not found")
      else
        with {:ok, prev_item, next_item_id} <- get_prev_and_next_items(playlist_id, prev_item_id),
             # Validate circular references BEFORE creating the playlist item
             :ok <-
               Castmill.Widgets.validate_playlist_references_for_widget(
                 widget_id,
                 playlist_id,
                 options
               ),
             # Validate that required integration credentials are configured
             :ok <-
               Castmill.Widgets.validate_integration_credentials_for_widget(
                 widget_id,
                 playlist.organization_id
               ),
             {:ok, item} <-
               create_playlist_item(%{
                 playlist_id: playlist_id,
                 offset: offset,
                 duration: duration,
                 prev_item_id: prev_item && prev_item.id,
                 next_item_id: next_item_id
               }),
             {:ok, widget_config} <-
               Castmill.Widgets.new_widget_config(widget_id, item.id, options),
             :ok <- link_playlist_items(prev_item, item) do
          # Return both item and widget_config_id for the frontend
          # Use Map.put since PlaylistItem struct doesn't have widget_config_id field
          Map.put(item, :widget_config_id, widget_config.id)
        else
          {:error, reason} -> Repo.rollback(reason)
          error -> Repo.rollback(to_string(error))
        end
      end
    end)
  end

  # Return nil safely without error
  def get_prev_and_next_items(playlist_id, nil) do
    first_item =
      Repo.one(
        from(item in PlaylistItem,
          where: is_nil(item.prev_item_id) and item.playlist_id == ^playlist_id
        )
      )

    {:ok, nil, first_item && first_item.id}
  end

  def get_prev_and_next_items(playlist_id, prev_item_id) do
    case Repo.one(
           from(item in PlaylistItem,
             where: item.id == ^prev_item_id and item.playlist_id == ^playlist_id
           )
         ) do
      nil -> {:error, "No previous item found with the given ID"}
      prev_item -> {:ok, prev_item, prev_item.next_item_id}
    end
  end

  defp link_playlist_items(nil, new_item) do
    next_item_id = new_item.next_item_id
    next_item = if next_item_id, do: Repo.get(PlaylistItem, next_item_id)

    # Update the next_item to point to new_item as the next item
    {:ok, _} = maybe_update_playlist_item(next_item, %{prev_item_id: new_item.id})
    :ok
  end

  defp link_playlist_items(prev_item, new_item) do
    next_item_id = prev_item && prev_item.next_item_id
    next_item = if next_item_id, do: Repo.get(PlaylistItem, next_item_id)

    # Update the prev_item and next_item to point to new_item as the next item
    results = [
      maybe_update_playlist_item(prev_item, %{next_item_id: new_item.id}),
      maybe_update_playlist_item(next_item, %{prev_item_id: new_item.id})
    ]

    # Process results to handle potential errors
    Enum.reduce(results, :ok, fn
      {:ok, _}, acc -> acc
      {:error, reason}, _ -> {:error, reason}
      # Catch-all clause to handle unexpected patterns
      _, acc -> acc
    end)
  end

  defp maybe_update_playlist_item(nil, _changes), do: {:ok, nil}

  defp maybe_update_playlist_item(item, changes) do
    case Repo.update(PlaylistItem.changeset(item, changes)) do
      {:ok, updated_item} -> {:ok, updated_item}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
    Remove an item from a playlist.
  """
  def remove_item_from_playlist(playlist_id, item_id) do
    # Use a transaction to remove a playlist item and update the items in the linked list atomically.
    Repo.transaction(fn ->
      item =
        from(item in PlaylistItem,
          where: item.id == ^item_id and item.playlist_id == ^playlist_id,
          select: item
        )
        |> Repo.one()

      prev_item_id = item.prev_item_id
      next_item_id = item.next_item_id

      if prev_item_id do
        from(item in PlaylistItem, where: item.id == ^prev_item_id)
        |> Repo.update_all(set: [next_item_id: next_item_id])
      end

      if next_item_id do
        from(item in PlaylistItem, where: item.id == ^next_item_id)
        |> Repo.update_all(set: [prev_item_id: prev_item_id])
      end

      Repo.delete(item)
    end)
  end

  @doc """
    Move an item from one position to another in a playlist.
    Moving an item requires updating 5 items in the linked list.

    1) the item to be moved
    2) the item that was before the item to be moved
    3) the item that was after the item to be moved
    4) the item that was before the item to be moved's new position
    5) the item that was after the item to be moved's new position
  """
  def move_item_in_playlist(item_id, target_item_id \\ nil) do
    if item_id == target_item_id do
      {:ok, nil}
    else
      # Use a transaction to move a playlist item and update the items in the linked list atomically.
      Repo.transaction(fn ->
        item = from(item in PlaylistItem, where: item.id == ^item_id, select: item) |> Repo.one()

        # Move the item out of its current position in the list
        if item.prev_item_id do
          from(prev_item in PlaylistItem, where: prev_item.id == ^item.prev_item_id)
          |> Repo.update_all(set: [next_item_id: item.next_item_id])
        end

        if item.next_item_id do
          from(next_item in PlaylistItem, where: next_item.id == ^item.next_item_id)
          |> Repo.update_all(set: [prev_item_id: item.prev_item_id])
        end

        # Move the item to its new position in the list
        if target_item_id do
          target_item =
            from(item in PlaylistItem, where: item.id == ^target_item_id, select: item)
            |> Repo.one()

          update_playlist_item(target_item, %{next_item_id: item_id})

          update_playlist_item(item, %{
            next_item_id: target_item.next_item_id,
            prev_item_id: target_item_id
          })

          if target_item.next_item_id do
            from(next_target_item in PlaylistItem,
              where: next_target_item.id == ^target_item.next_item_id
            )
            |> Repo.update_all(set: [prev_item_id: item_id])
          end
        else
          # Move the item to the head of the list
          head_item =
            from(item in PlaylistItem,
              where: is_nil(item.prev_item_id) and item.playlist_id == ^item.playlist_id,
              select: item
            )
            |> Repo.one()

          update_playlist_item(item, %{next_item_id: head_item.id, prev_item_id: nil})
          update_playlist_item(head_item, %{prev_item_id: item.id})
        end
      end)
    end
  end

  @doc """
    Returns all the items belonging to a playlist in the order
    defined by the links of the linked list they are part of.

    Note: this method is not used by the API, it is only used to
    test the linked list implementation.
  """
  def get_playlist_items(playlist_id) do
    items_query =
      from(pi in Castmill.Resources.PlaylistItem,
        where: pi.playlist_id == ^playlist_id,
        join: wd in assoc(pi, :widget_config),
        join: w in assoc(wd, :widget),
        preload: [widget_config: {wd, widget: w}]
      )

    items = Repo.all(items_query)

    LinkedList.sort_nodes(items)
  end

  def get_playlist_item(playlist_id, item_id) do
    items_query =
      from(pi in Castmill.Resources.PlaylistItem,
        where: pi.playlist_id == ^playlist_id and pi.id == ^item_id
      )

    Repo.one(items_query)
  end

  # Helper function to apply sorting to a query based on params
  # Supports key (column name) and direction (ascending/descending)
  defp apply_sorting(query, params) do
    sort_key = Map.get(params, :key)
    sort_direction = Map.get(params, :direction, "ascending")

    # Convert sort direction string to atom
    sort_dir =
      case sort_direction do
        "ascending" -> :asc
        "descending" -> :desc
        _ -> :asc
      end

    # Convert sort key string to atom, with validation
    # Only allow sorting by known safe columns to prevent SQL injection
    sort_field =
      case sort_key do
        "name" -> :name
        "inserted_at" -> :inserted_at
        "updated_at" -> :updated_at
        _ -> :name
      end

    Ecto.Query.order_by(query, [{^sort_dir, ^sort_field}])
  end

  @doc """
  Returns the list of a given resource for a given organization.

  ## Examples

      iex> list_resources(Media, params)
      [%Media{}, ...]
  """
  def list_resources(resource, %{
        organization_id: organization_id,
        page: page,
        page_size: page_size,
        search: search,
        filters: filters,
        team_id: team_id
      } = params)
      when not is_nil(team_id) do
    offset = (page_size && max((page - 1) * page_size, 0)) || 0

    preloads =
      if function_exported?(resource, :preloads, 0) do
        resource.preloads()
      else
        []
      end

    # Get the join module for this resource type
    {join_module, foreign_key} = get_team_join_info(resource)

    # Build query with team filter
    query =
      resource.base_query()
      |> Organization.where_org_id(organization_id)
      |> join(:inner, [r], t in ^join_module, on: field(t, ^foreign_key) == r.id)
      |> where([_, t], t.team_id == ^team_id)
      |> QueryHelpers.apply_combined_filters(filters, resource)
      |> QueryHelpers.where_name_like(search)
      |> apply_sorting(params)
      |> Ecto.Query.limit(^page_size)
      |> Ecto.Query.offset(^offset)
      |> Ecto.Query.preload(^preloads)

    Repo.all(query)
  end

  def list_resources(resource, %{
        organization_id: organization_id,
        page: page,
        page_size: page_size,
        search: search,
        filters: filters
      } = params) do
    offset = (page_size && max((page - 1) * page_size, 0)) || 0

    preloads =
      if function_exported?(resource, :preloads, 0) do
        resource.preloads()
      else
        []
      end

    resource.base_query()
    |> Organization.where_org_id(organization_id)
    |> QueryHelpers.apply_combined_filters(filters, resource)
    |> QueryHelpers.where_name_like(search)
    |> Ecto.Query.distinct(true)
    |> apply_sorting(params)
    |> Ecto.Query.limit(^page_size)
    |> Ecto.Query.offset(^offset)
    |> Ecto.Query.preload(^preloads)
    |> Repo.all()
  end

  def list_resources(resource, %{page: page, page_size: page_size, search: search}) do
    list_resources(resource, %{
      organization_id: nil,
      page: page,
      page_size: page_size,
      search: search,
      filters: nil
    })
  end

  def list_resources(resource, %{organization_id: organization_id}) do
    list_resources(resource, %{
      organization_id: organization_id,
      page: 1,
      page_size: nil,
      search: nil,
      filters: nil
    })
  end

  def list_resources(resource, %{organization_id: organization_id, filters: filters}) do
    list_resources(resource, %{
      organization_id: organization_id,
      page: 1,
      page_size: nil,
      search: nil,
      filters: filters
    })
  end

  def count_resources(resource, %{
        organization_id: organization_id,
        search: search,
        filters: filters,
        team_id: team_id
      })
      when not is_nil(team_id) do
    # Get the join module for this resource type
    {join_module, foreign_key} = get_team_join_info(resource)

    resource.base_query()
    |> Organization.where_org_id(organization_id)
    |> join(:inner, [r], t in ^join_module, on: field(t, ^foreign_key) == r.id)
    |> where([_, t], t.team_id == ^team_id)
    |> QueryHelpers.apply_combined_filters(filters, resource)
    |> QueryHelpers.where_name_like(search)
    |> Repo.aggregate(:count, :id)
  end

  def count_resources(resource, %{
        organization_id: organization_id,
        search: search,
        filters: filters
      }) do
    resource.base_query()
    |> Organization.where_org_id(organization_id)
    |> QueryHelpers.apply_combined_filters(filters, resource)
    |> QueryHelpers.where_name_like(search)
    |> Repo.aggregate(:count, :id)
  end

  def count_resources(resource, %{search: search}) do
    count_resources(resource, %{organization_id: nil, search: search, filters: nil})
  end

  def count_resources(resource, %{organization_id: organization_id}) do
    count_resources(resource, %{organization_id: organization_id, search: nil, filters: nil})
  end

  def count_resources(resource, %{organization_id: organization_id, filters: filters}) do
    count_resources(resource, %{organization_id: organization_id, search: nil, filters: filters})
  end

  # Helper function to get the team join module and foreign key for a resource type
  defp get_team_join_info(resource) do
    case resource do
      Castmill.Resources.Media ->
        {Castmill.Teams.TeamsMedias, :media_id}

      Castmill.Resources.Playlist ->
        {Castmill.Teams.TeamsPlaylists, :playlist_id}

      Castmill.Resources.Channel ->
        {Castmill.Teams.TeamsChannels, :channel_id}

      Castmill.Resources.Layout ->
        {Castmill.Teams.TeamsLayouts, :layout_id}

      Castmill.Devices.Device ->
        {Castmill.Teams.TeamsDevices, :device_id}

      _ ->
        raise "Unsupported resource type for team filtering: #{inspect(resource)}"
    end
  end

  @doc """
  Creates a media.

  ## Examples

      iex> create_media(%{field: value})
      {:ok, %Media{}}

      iex> create_media(%{field: bad_value})
      {:error, %Ecto.Changeset{}}
  """
  def create_media(attrs \\ %{}) do
    organization_id = Map.get(attrs, "organization_id") || Map.get(attrs, :organization_id)

    # Check quota before creating the media
    with :ok <- check_resource_quota(organization_id, Media, :medias) do
      %Media{}
      |> Media.changeset(attrs)
      |> Repo.insert()
    else
      {:error, :quota_exceeded} -> {:error, :quota_exceeded}
    end
  end

  @doc """
    Updates a media. Note that only the name of a media can be updated, the rest
    of the fields are immutable. If field other than name is passed in, it will
    be ignored.
  """
  def update_media(%Media{} = media, attrs) do
    media
    |> Media.update_changeset(attrs)
    |> Repo.update()
  end

  @doc """
    Gets a media. It returns all the files associated with the media as well.
  """
  def get_media(id) do
    media =
      Media
      |> where(id: ^id)
      |> Repo.one()
      |> Repo.preload(files_medias: [:file])

    if is_nil(media) do
      nil
    else
      transformed_files =
        Enum.reduce(media.files_medias, %{}, fn files_media, acc ->
          Map.put(acc, files_media.context, files_media.file)
        end)

      Map.put(media, :files, transformed_files)
    end
  end

  @doc """
  Removes a media. Note that this will not remove the media from the
  storage system. It will only remove the record from the database, however
  it will trigger a "delete" webhook event if such a webhook is configured.
  """
  def delete_media(%Media{} = media) do
    # Check if the media is being used as an organization logo
    org_using_logo =
      Repo.one(
        from o in Organization,
          where: o.logo_media_id == ^media.id,
          limit: 1
      )

    if org_using_logo do
      {:error, :media_in_use_as_logo}
    else
      # Get all the files belonging to the media
      media = get_media(media.id)

      # Iterate through all the files and delete them
      Enum.each(media.files, fn {_context, file} ->
        delete_file_from_storage(file)
      end)

      # Create a transaction for deleting the media and all its associated files
      Repo.transaction(fn ->
        # Delete all the file medias and files associated with the media
        from(files_medias in FilesMedias, where: files_medias.media_id == ^media.id)
        |> Repo.delete_all()

        file_ids = Enum.map(media.files, fn {_context, file} -> file.id end)

        from(f in Castmill.Files.File, where: f.id in ^file_ids)
        |> Repo.delete_all()

        # Delete the media itself
        case Repo.delete(media) do
          {:ok, struct} -> struct
          {:error, changeset} -> raise "Failed to delete media: #{inspect(changeset)}"
        end
      end)
    end
  end

  defp delete_file_from_storage(%Castmill.Files.File{uri: uri}) do
    case Application.get_env(:castmill, :file_storage) do
      :local ->
        case get_local_file_path(uri) do
          {:ok, file_path} -> File.rm(file_path)
          {:error, _reason} -> {:error, :invalid_path}
        end

      :s3 ->
        {bucket, object_path} = get_s3_file_path(uri)

        ExAws.S3.delete_object(bucket, object_path)
        |> ExAws.request()
    end
  end

  defp get_local_file_path(uri) do
    # Assuming your URIs are built like "http://localhost:4000/medias/dst_path/filename"
    # Strip off the "http://localhost:4000" and return the path that starts with "medias/..."

    base_directory = Path.join([Application.app_dir(:castmill), "priv", "static"])

    uri
    |> URI.parse()
    |> then(fn %URI{path: path} ->
      String.trim_leading(path, "/")
    end)
    |> (fn relative_path ->
          full_path = Path.expand(relative_path, base_directory)

          if String.starts_with?(full_path, base_directory) do
            {:ok, full_path}
          else
            {:error, "Path traversal detected"}
          end
        end).()
  end

  defp get_s3_file_path(uri) do
    # Assuming your URIs are built with get_s3_uri/2 function
    # Example: "https://s3.amazonaws.com:443/my-bucket/path/to/file"
    # We need to extract the bucket and file path
    uri
    |> URI.parse()
    |> then(fn %URI{path: path} ->
      # The path includes the bucket and the file path, e.g., "/my-bucket/path/to/file"
      # Split the path into the bucket and the file path
      [_slash, bucket | object_parts] = String.split(path, "/", parts: 3)
      object_path = Enum.join(object_parts, "/")

      {bucket, object_path}
    end)
  end

  @doc """
  Creates a channel.

  ## Examples

      iex> create_channel(%{field: value})
      {:ok, %Channel{}}

      iex> create_channel(%{field: bad_value})
      {:error, %Ecto.Changeset{}}
  """
  def create_channel(attrs \\ %{}) do
    %Channel{}
    |> Channel.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
    Gets a channel.
  """
  def get_channel(id) do
    Channel
    |> where(id: ^id)
    |> Repo.one()
    |> Repo.preload(:entries)
  end

  @doc """
    Updates a channel.
  """
  def update_channel(%Channel{} = channel, attrs) do
    channel
    |> Channel.changeset(attrs)
    |> Repo.update()
  end

  @doc """
    Add entry to channel. Will give an error if the entry overlaps
    with an existing entry.
  """
  def add_channel_entry(channel_id, entry_attrs \\ %{}) do
    # Convert timestamps to DateTime structs
    entry_attrs =
      entry_attrs
      |> Map.update("start", nil, &DateTime.from_unix!(&1, :millisecond))
      |> Map.update("end", nil, &DateTime.from_unix!(&1, :millisecond))

    %ChannelEntry{
      channel_id: channel_id
    }
    |> ChannelEntry.changeset(entry_attrs)
    |> Repo.insert()
  end

  @doc """
    Get a channel entry.
  """
  def get_channel_entry(id) do
    ChannelEntry
    |> where(id: ^id)
    |> Repo.one()
  end

  @doc """
    Update entry in channel.
  """
  def update_channel_entry(%ChannelEntry{} = entry, attrs) do
    attrs =
      Map.new(attrs, fn
        {"start", val} -> {"start", DateTime.from_unix!(val, :millisecond)}
        {"end", val} -> {"end", DateTime.from_unix!(val, :millisecond)}
        {key, val} -> {key, val}
      end)

    entry
    |> ChannelEntry.changeset(attrs)
    |> Repo.update()
  end

  @doc """
    Remove entry from channel.
  """
  def delete_channel_entry(%ChannelEntry{} = entry) do
    Repo.delete(entry)
  end

  @doc """
    List channel entries between two dates.
  """
  def list_channel_entries(channel_id, start_ts \\ 0, end_ts \\ 253_402_300_799) do
    start_datetime = DateTime.from_unix!(start_ts, :millisecond)
    end_datetime = DateTime.from_unix!(end_ts, :millisecond)

    query =
      from(entry in ChannelEntry,
        where:
          entry.channel_id == ^channel_id and
            ((is_nil(entry.repeat_weekly_until) and
                entry.start < ^end_datetime and
                entry.end > ^start_datetime) or
               (not is_nil(entry.repeat_weekly_until) and
                  entry.start < ^end_datetime and
                  entry.repeat_weekly_until >= ^DateTime.to_date(start_datetime))),
        select: entry
      )

    Repo.all(query)
  end

  @doc """
  Checks if a channel has any devices assigned to it.
  """
  def channel_has_devices?(%Channel{id: channel_id}) do
    channel_has_devices?(channel_id)
  end

  def channel_has_devices?(channel_id) when is_integer(channel_id) do
    query =
      from(dc in Castmill.Devices.DevicesChannels,
        where: dc.channel_id == ^channel_id,
        select: count(dc.device_id)
      )

    Repo.one(query) > 0
  end

  @doc """
  Gets the devices that are using a specific channel.
  Returns a list of maps with device id and name.
  """
  def get_devices_using_channel(channel_id) when is_integer(channel_id) do
    query =
      from(dc in Castmill.Devices.DevicesChannels,
        join: d in Castmill.Devices.Device,
        on: dc.device_id == d.id,
        where: dc.channel_id == ^channel_id,
        select: %{id: d.id, name: d.name}
      )

    Repo.all(query)
  end

  @doc """
  Removes a channel and all its entries.
  Returns {:error, :channel_has_devices} if the channel is assigned to any devices.
  """
  def delete_channel(%Channel{} = channel) do
    if channel_has_devices?(channel) do
      {:error, :channel_has_devices}
    else
      Repo.delete(channel)
    end
  end

  @doc """
  Returns the list of layouts including both organization-specific and system layouts.
  """
  def list_layouts(%{
        organization_id: organization_id,
        page: page,
        page_size: page_size,
        search: search,
        filters: filters
      } = params) do
    offset = (page_size && max((page - 1) * page_size, 0)) || 0

    Layout.base_query()
    |> Layout.where_org_id_or_system(organization_id)
    |> QueryHelpers.apply_combined_filters(filters, Layout)
    |> QueryHelpers.where_name_like(search)
    |> Ecto.Query.distinct(true)
    |> apply_sorting(params)
    |> Ecto.Query.limit(^page_size)
    |> Ecto.Query.offset(^offset)
    |> Repo.all()
  end

  def list_layouts(%{organization_id: organization_id}) do
    list_layouts(%{
      organization_id: organization_id,
      page: 1,
      page_size: nil,
      search: nil,
      filters: nil
    })
  end

  def list_layouts(%{organization_id: organization_id, filters: filters}) do
    list_layouts(%{
      organization_id: organization_id,
      page: 1,
      page_size: nil,
      search: nil,
      filters: filters
    })
  end

  @doc """
  Returns the count of layouts including both organization-specific and system layouts.
  """
  def count_layouts(%{
        organization_id: organization_id,
        search: search,
        filters: filters
      }) do
    Layout.base_query()
    |> Layout.where_org_id_or_system(organization_id)
    |> QueryHelpers.apply_combined_filters(filters, Layout)
    |> QueryHelpers.where_name_like(search)
    |> Ecto.Query.distinct(true)
    |> Repo.aggregate(:count)
  end

  def count_layouts(%{organization_id: organization_id}) do
    count_layouts(%{
      organization_id: organization_id,
      search: nil,
      filters: nil
    })
  end
end

defmodule LinkedList do
  def sort_nodes(nodes) do
    # First build hash with all the nodes so that we can easily access them
    # by id.
    nodes_map = Enum.map(nodes, fn node -> {node.id, node} end) |> Map.new()

    # Next, we need to find the head of the linked list.
    # The head is the node with prev_node = nil.
    head = Enum.find(nodes, fn node -> is_nil(node.prev_item_id) end)

    # We can now traverse the linked list by following the next_node links
    # starting from the head node. We will keep track of the sorted nodes in
    # a list as we traverse the linked list.
    traverse_linked_list(head, nodes_map, [])
  end

  defp traverse_linked_list(nil, _nodes, sorted_nodes), do: sorted_nodes

  defp traverse_linked_list(node, nodes_map, sorted_nodes) do
    if length(sorted_nodes) > map_size(nodes_map) do
      raise "Circular dependency detected in linked list"
    end

    # Recursively traverse the linked list, adding each node to the sorted list.
    [node | traverse_linked_list(nodes_map[node.next_item_id], nodes_map, sorted_nodes)]
  end
end
