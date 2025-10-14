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
        |> Enum.map(&transform_item/1)

      %{playlist | items: items}
    end
  end

  defp transform_item(item) do
    # Resolve widget references and get the updated options
    resolved_options =
      resolve_widget_references(
        item.widget_config.widget.options_schema || %{},
        item.widget_config.options
      )

    # Drop the :widget key from widget_config
    modified_widget_config = Map.drop(item.widget_config, [:widget])

    # Merge the resolved options into modified_widget_config
    modified_widget_config_with_resolved_options =
      Map.put(modified_widget_config, :options, resolved_options)

    # Take required fields from item and merge the modified widget data and other info
    item
    |> Map.take([:id, :duration, :offset, :inserted_at, :updated_at])
    |> Map.merge(%{
      config: modified_widget_config_with_resolved_options,
      widget: item.widget_config.widget
    })
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
      media_id -> get_media(media_id)
    end
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
    Removes a playlist.
  """
  def delete_playlist(%Playlist{} = playlist) do
    Repo.delete(playlist)
  end

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
      with {:ok, prev_item, next_item_id} <- get_prev_and_next_items(playlist_id, prev_item_id),
           {:ok, item} <-
             create_playlist_item(%{
               playlist_id: playlist_id,
               offset: offset,
               duration: duration,
               prev_item_id: prev_item && prev_item.id,
               next_item_id: next_item_id
             }),
           {:ok, _widget_config} <-
             Castmill.Widgets.new_widget_config(widget_id, item.id, options),
           :ok <- link_playlist_items(prev_item, item) do
        item
      else
        {:error, reason} -> Repo.rollback(reason)
        error -> Repo.rollback(to_string(error))
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
      })
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
      |> Ecto.Query.order_by([d], asc: d.name)
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
      }) do
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
    |> Ecto.Query.order_by([d], asc: d.name)
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
    org_using_logo = Repo.one(
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
