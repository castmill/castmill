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
  alias Castmill.Resources.Calendar
  alias Castmill.Resources.CalendarEntry

  alias Castmill.Organizations.Organization

  alias Castmill.Protocol.Access

  def canAccessResource(resource, user, action) do
    if user == nil do
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

  @doc """
    Can access the resource.
    User can only access a resource if he has access to the organization that owns the resource
    and has the right access level.

    Access level is defined when adding a user to an organization via the organization_users table.
  """
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

  defimpl Access, for: Calendar do
    def canAccess(resource, user, action) do
      Castmill.Resources.canAccessResource(resource, user, action)
    end
  end

  defimpl Access, for: Device do
    def canAccess(resource, user, action) do
      Castmill.Resources.canAccessResource(resource, user, action)
    end
  end

  alias Castmill.Protocol.Resource

  defimpl Resource, for: Media do
    def type(_value), do: "media"
  end

  defimpl Resource, for: Playlist do
    def type(_value), do: "playlist"
  end

  defimpl Resource, for: Calendar do
    def type(_value), do: "calendar"
  end

  defimpl Resource, for: Device do
    def type(_value), do: "device"
  end

  @doc """
  Creates a playlist
  """
  def create_playlist(attrs \\ %{}) do
    %Playlist{}
    |> Playlist.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Update a playlist
  """
  def update(%Playlist{} = playlist, attrs) do
    playlist
    |> Playlist.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Update a media
  """
  def update(%Media{} = media, attrs) do
    media
    |> Media.changeset(attrs)
    |> Repo.update()
  end

  @doc """
    Returns the list of playlists for the given organization

    ## Examples

    iex> list_users()
    [%User{}, ...]
  """
  def list_playlists(organization_id) do
    query =
      from playlist in Playlist,
        where: playlist.organization_id == ^organization_id,
        select: playlist

    Repo.all(query)
  end

  def list_playlists() do
    Repo.all(Playlist)
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
  """
  def insert_item_into_playlist(
        playlist_id,
        prev_item_id,
        widget_id,
        offset,
        duration,
        options \\ %{}
      ) do
    # Use a transaction to create a playlist item and update the items in the linked list atomically.
    Repo.transaction(fn ->
      if prev_item_id do
        prev_item =
          from(item in PlaylistItem, where: item.id == ^prev_item_id, select: item) |> Repo.one()

        next_item_id = prev_item.next_item_id

        with {:ok, item} <-
               create_playlist_item(%{
                 playlist_id: playlist_id,
                 widget_id: widget_id,
                 offset: offset,
                 duration: duration,
                 options: options,
                 prev_item_id: prev_item.id,
                 next_item_id: next_item_id
               }) do
          update_playlist_item(prev_item, %{next_item_id: item.id})

          if next_item_id do
            next_item =
              from(item in PlaylistItem, where: item.id == ^next_item_id, select: item)
              |> Repo.one()

            update_playlist_item(next_item, %{prev_item_id: item.id})
          end

          item
        end
      else
        # Since we are inserting at the beginning of the list, get the current first item and update
        # it accordingly.
        first_item =
          from(item in PlaylistItem,
            where: is_nil(item.prev_item_id) and item.playlist_id == ^playlist_id,
            select: item
          )
          |> Repo.one()

        with {:ok, item} <-
               create_playlist_item(%{
                 playlist_id: playlist_id,
                 widget_id: widget_id,
                 offset: offset,
                 duration: duration,
                 options: options,
                 prev_item_id: nil,
                 next_item_id: first_item && first_item.id
               }) do
          if first_item do
            update_playlist_item(first_item, %{prev_item_id: item.id})
          end

          item
        end
      end
    end)
  end

  @doc """
    Remove an item from a playlist.
  """
  def remove_item_from_playlist(item_id) do
    # Use a transaction to remove a playlist item and update the items in the linked list atomically.
    Repo.transaction(fn ->
      item = from(item in PlaylistItem, where: item.id == ^item_id, select: item) |> Repo.one()
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
  """
  def get_playlist_items(playlist_id) do
    items = Repo.all(PlaylistItem, playlist_id: playlist_id) |> Repo.preload(:widget)
    LinkedList.sort_nodes(items)
  end

  @doc """
  Returns the list of a given resource for a given organization.

  ## Examples

      iex> list_resource(Media, organization_id)
      [%Media{}, ...]
  """
  def list_resource(resource, organization_id) do
    resource.base_query()
    |> Organization.where_org_id(organization_id)
    |> Repo.all()
  end

  def list_resource(resource) do
    Repo.all(resource)
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
    %Media{}
    |> Media.changeset(attrs)
    |> Repo.insert()
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
  Removes a media. Note that this will not remove the media from the
  storage system. It will only remove the record from the database, however
  it will trigger a "delete" webhook event if such a webhook is configured.
  """
  def delete_media(%Media{} = media) do
    # TODO: Call relevant webhooks so that the integration has a chance to
    # clean up the media from the storage system.
    Repo.delete(media)
  end

  @doc """
  Creates a calendar.

  ## Examples

      iex> create_calendar(%{field: value})
      {:ok, %Media{}}

      iex> create_calendar(%{field: bad_value})
      {:error, %Ecto.Changeset{}}
  """
  def create_calendar(attrs \\ %{}) do
    %Calendar{}
    |> Calendar.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
    Updates a calendar.
  """
  def update_calendar(%Calendar{} = calendar, attrs) do
    calendar
    |> Calendar.changeset(attrs)
    |> Repo.update()
  end

  @doc """
    Add entry to calendar. Will give an error if the entry overlaps
    with an existing entry.
  """
  def add_calendar_entry(calendar_id, playlist_id, entry_attrs \\ %{}) do
    %CalendarEntry{
      calendar_id: calendar_id,
      playlist_id: playlist_id
    }
    |> CalendarEntry.changeset(entry_attrs)
    |> Repo.insert()
  end

  @doc """
    Update entry in calendar.
  """
  def update_calendar_entry(%CalendarEntry{} = entry, attrs) do
    entry
    |> CalendarEntry.changeset(attrs)
    |> Repo.update()
  end

  @doc """
    Remove entry from calendar.
  """
  def delete_calendar_entry(%CalendarEntry{} = entry) do
    Repo.delete(entry)
  end

  @doc """
    List calendar entries between two dates.
  """
  def list_calendar_entries(calendar_id, start_date, end_date) do
    query =
      from entry in CalendarEntry,
        where:
          entry.calendar_id == ^calendar_id and
            entry.start >= ^start_date and
            (entry.end <= ^end_date or entry.repeat_weekly_until <= ^end_date),
        select: entry

    Repo.all(query)
  end

  @doc """
  Removes a calendar and all its entries.
  """
  def delete_calendar(%Calendar{} = calendar) do
    Repo.delete(calendar)
  end
end

defmodule LinkedList do
  def sort_nodes(nodes) do
    # First build hash with all the nodes so that we can easily access them
    # by id.
    nodes_map = Enum.map(nodes, fn node -> {node.id, node} end) |> Map.new()

    # Next, we need to find the head of the linked list.
    # The head is the node with prev_node = nil.
    head = Enum.find(nodes, fn node -> node.prev_item_id == nil end)

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
