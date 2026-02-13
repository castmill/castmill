defmodule Castmill.Tags do
  @moduledoc """
  The Tags context.

  This module provides functions for managing tags and tag groups, which allow
  users to organize their resources (medias, devices, playlists, channels)
  according to their own taxonomy.

  ## Key Concepts

  - **Tags**: User-defined labels for organizing resources
  - **Tag Groups**: Optional categories for organizing tags (e.g., "Location", "Campaign")
  - **Resource Tags**: Association between tags and resources (polymorphic)

  ## Usage Examples

      # Create a tag
      {:ok, tag} = Tags.create_tag(%{
        name: "London Office",
        color: "#3B82F6",
        organization_id: org_id
      })

      # Tag a resource
      {:ok, _} = Tags.tag_resource(tag.id, :media, media_id)

      # Get all resources with specific tags
      media_ids = Tags.get_resource_ids_with_tags(:media, [tag_id1, tag_id2], :any)

      # Filter query by tags
      query = Tags.filter_by_tags(Media.base_query(), :media, [tag_id1, tag_id2])
  """

  import Ecto.Query, warn: false
  alias Castmill.Repo

  alias Castmill.Tags.Tag
  alias Castmill.Tags.TagGroup
  alias Castmill.Tags.ResourceTag

  # ============================================================================
  # Tag Groups
  # ============================================================================

  @doc """
  Returns the list of tag groups for an organization.

  ## Options

    * `:preload_tags` - When true, preloads the tags for each group

  ## Examples

      iex> list_tag_groups(org_id)
      [%TagGroup{}, ...]

      iex> list_tag_groups(org_id, preload_tags: true)
      [%TagGroup{tags: [%Tag{}, ...]}, ...]
  """
  def list_tag_groups(organization_id, opts \\ []) do
    query =
      TagGroup.base_query()
      |> TagGroup.where_organization_id(organization_id)
      |> TagGroup.order_by_position()

    query =
      if Keyword.get(opts, :preload_tags, false) do
        from(tg in query, preload: [:tags])
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Gets a single tag group.

  Raises `Ecto.NoResultsError` if the Tag group does not exist.
  """
  def get_tag_group!(id), do: Repo.get!(TagGroup, id)

  @doc """
  Gets a single tag group by id, returning nil if not found.
  """
  def get_tag_group(id), do: Repo.get(TagGroup, id)

  @doc """
  Creates a tag group.
  """
  def create_tag_group(attrs \\ %{}) do
    %TagGroup{}
    |> TagGroup.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a tag group.
  """
  def update_tag_group(%TagGroup{} = tag_group, attrs) do
    tag_group
    |> TagGroup.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a tag group.

  Tags in the group will have their tag_group_id set to nil (not deleted).
  """
  def delete_tag_group(%TagGroup{} = tag_group) do
    Repo.delete(tag_group)
  end

  # ============================================================================
  # Tags
  # ============================================================================

  @doc """
  Returns the list of tags for an organization.

  ## Options

    * `:tag_group_id` - Filter by tag group
    * `:preload_tag_group` - When true, preloads the tag group

  ## Examples

      iex> list_tags(org_id)
      [%Tag{}, ...]

      iex> list_tags(org_id, tag_group_id: 1)
      [%Tag{}, ...]
  """
  def list_tags(organization_id, opts \\ []) do
    query =
      Tag.base_query()
      |> Tag.where_organization_id(organization_id)
      |> Tag.where_tag_group_id(Keyword.get(opts, :tag_group_id))
      |> Tag.order_by_position()

    query =
      if Keyword.get(opts, :preload_tag_group, false) do
        Tag.preload_tag_group(query)
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Gets a single tag.

  Raises `Ecto.NoResultsError` if the Tag does not exist.
  """
  def get_tag!(id), do: Repo.get!(Tag, id)

  @doc """
  Gets a single tag by id, returning nil if not found.
  """
  def get_tag(id), do: Repo.get(Tag, id)

  @doc """
  Creates a tag.
  """
  def create_tag(attrs \\ %{}) do
    %Tag{}
    |> Tag.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a tag.
  """
  def update_tag(%Tag{} = tag, attrs) do
    tag
    |> Tag.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a tag.

  This will also delete all resource_tags associations.
  """
  def delete_tag(%Tag{} = tag) do
    Repo.delete(tag)
  end

  @doc """
  Returns the default color palette for tags.
  """
  def color_palette, do: Tag.color_palette()

  # ============================================================================
  # Resource Tags
  # ============================================================================

  @doc """
  Gets tags for a specific resource.

  ## Examples

      iex> get_resource_tags(:media, 42)
      [%Tag{}, ...]
  """
  def get_resource_tags(resource_type, resource_id) do
    from(t in Tag,
      join: rt in ResourceTag,
      on: rt.tag_id == t.id,
      where: rt.resource_type == ^resource_type and rt.resource_id == ^resource_id,
      order_by: [asc: t.position, asc: t.name]
    )
    |> Repo.all()
  end

  @doc """
  Tags a resource with a specific tag.

  ## Examples

      iex> tag_resource(tag_id, :media, 42)
      {:ok, %ResourceTag{}}

      iex> tag_resource(invalid_tag_id, :media, 42)
      {:error, %Ecto.Changeset{}}
  """
  def tag_resource(tag_id, resource_type, resource_id) do
    %ResourceTag{}
    |> ResourceTag.changeset(%{
      tag_id: tag_id,
      resource_type: resource_type,
      resource_id: resource_id
    })
    |> Repo.insert(on_conflict: :nothing)
  end

  @doc """
  Untags a resource (removes a specific tag from it).

  ## Examples

      iex> untag_resource(tag_id, :media, 42)
      {:ok, %ResourceTag{}}

      iex> untag_resource(tag_id, :media, non_existent_id)
      {:error, :not_found}
  """
  def untag_resource(tag_id, resource_type, resource_id) do
    case Repo.get_by(ResourceTag,
           tag_id: tag_id,
           resource_type: resource_type,
           resource_id: resource_id
         ) do
      nil -> {:error, :not_found}
      resource_tag -> Repo.delete(resource_tag)
    end
  end

  @doc """
  Sets the tags for a resource, replacing all existing tags.

  ## Examples

      iex> set_resource_tags(:media, 42, [tag_id1, tag_id2])
      {:ok, [%ResourceTag{}, ...]}
  """
  def set_resource_tags(resource_type, resource_id, tag_ids) when is_list(tag_ids) do
    Repo.transaction(fn ->
      # Delete existing tags
      from(rt in ResourceTag,
        where: rt.resource_type == ^resource_type and rt.resource_id == ^resource_id
      )
      |> Repo.delete_all()

      # Insert new tags
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      entries =
        tag_ids
        |> Enum.map(fn tag_id ->
          %{
            tag_id: tag_id,
            resource_type: resource_type,
            resource_id: resource_id,
            inserted_at: now,
            updated_at: now
          }
        end)

      case entries do
        [] ->
          []

        _ ->
          {_, inserted_tags} = Repo.insert_all(ResourceTag, entries, returning: true)
          inserted_tags
      end
    end)
  end

  @doc """
  Adds multiple tags to a resource (without removing existing tags).

  ## Examples

      iex> add_tags_to_resource(:media, 42, [tag_id1, tag_id2])
      {:ok, [%ResourceTag{}, ...]}
  """
  def add_tags_to_resource(resource_type, resource_id, tag_ids) when is_list(tag_ids) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    entries =
      tag_ids
      |> Enum.map(fn tag_id ->
        %{
          tag_id: tag_id,
          resource_type: resource_type,
          resource_id: resource_id,
          inserted_at: now,
          updated_at: now
        }
      end)

    case entries do
      [] ->
        {:ok, []}

      _ ->
        {_, inserted_tags} =
          Repo.insert_all(ResourceTag, entries, on_conflict: :nothing, returning: true)

        {:ok, inserted_tags}
    end
  end

  @doc """
  Removes all tags from a resource.

  ## Examples

      iex> clear_resource_tags(:media, 42)
      {count, nil}
  """
  def clear_resource_tags(resource_type, resource_id) do
    from(rt in ResourceTag,
      where: rt.resource_type == ^resource_type and rt.resource_id == ^resource_id
    )
    |> Repo.delete_all()
  end

  # ============================================================================
  # Tag Filtering for Queries
  # ============================================================================

  @doc """
  Gets resource IDs that match the given tag filters.

  ## Options

    * `:mode` - `:any` (OR logic) or `:all` (AND logic). Default: `:any`

  ## Examples

      # Resources with ANY of the tags
      iex> get_resource_ids_with_tags(:media, [1, 2, 3], :any)
      [1, 2, 5, 8]

      # Resources with ALL of the tags
      iex> get_resource_ids_with_tags(:media, [1, 2], :all)
      [2, 8]
  """
  def get_resource_ids_with_tags(resource_type, tag_ids, mode \\ :any)

  def get_resource_ids_with_tags(_resource_type, [], _mode), do: []

  def get_resource_ids_with_tags(resource_type, tag_ids, :any) do
    ResourceTag.resource_ids_with_any_tags(resource_type, tag_ids)
    |> Repo.all()
  end

  def get_resource_ids_with_tags(resource_type, tag_ids, :all) do
    ResourceTag.resource_ids_with_all_tags(resource_type, tag_ids)
    |> Repo.all()
  end

  @doc """
  Filters a query to only include resources with the given tags.

  This is useful for adding tag filtering to existing resource queries.

  ## Options

    * `:mode` - `:any` (OR logic) or `:all` (AND logic). Default: `:any`
    * `:id_field` - The field name for the resource ID in the query. Default: `:id`

  ## Examples

      # In a resource context (e.g., Medias):
      def list_medias(org_id, opts) do
        query = Media.base_query()
        |> Media.where_organization_id(org_id)

        tag_ids = Keyword.get(opts, :tag_ids, [])
        query = Tags.filter_by_tags(query, :media, tag_ids)

        Repo.all(query)
      end
  """
  def filter_by_tags(query, _resource_type, []), do: query

  def filter_by_tags(query, resource_type, tag_ids, opts \\ []) when is_list(tag_ids) do
    mode = Keyword.get(opts, :mode, :any)
    id_field = Keyword.get(opts, :id_field, :id)

    resource_ids = get_resource_ids_with_tags(resource_type, tag_ids, mode)

    case resource_ids do
      [] ->
        # No resources match - return empty result
        from(q in query, where: false)

      ids ->
        # resource_ids are stored as strings. For resources with integer PKs
        # (media, playlist, channel) we convert them back to integers so the
        # IN clause matches the column type. For UUID PKs (device) we keep
        # them as strings — Ecto handles the binary_id cast automatically.
        typed_ids = cast_resource_ids(resource_type, ids)
        from(q in query, where: field(q, ^id_field) in ^typed_ids)
    end
  end

  # Devices use binary_id (UUID) primary keys — keep as strings.
  # Filter out any non-UUID values (e.g. garbage from pre-migration data).
  defp cast_resource_ids(:device, ids) do
    Enum.filter(ids, &valid_uuid?/1)
  end

  # All other resource types use integer primary keys.
  # Filter out any values that can't be parsed as integers.
  defp cast_resource_ids(_type, ids) do
    ids
    |> Enum.flat_map(fn id ->
      case Integer.parse(id) do
        {int_val, ""} -> [int_val]
        _ -> []
      end
    end)
  end

  # Validates that a string is a valid UUID (8-4-4-4-12 hex format).
  defp valid_uuid?(str) when is_binary(str) do
    Regex.match?(~r/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i, str)
  end

  defp valid_uuid?(_), do: false

  # ============================================================================
  # Bulk Operations
  # ============================================================================

  @doc """
  Adds a tag to multiple resources at once.

  ## Examples

      iex> bulk_tag_resources(tag_id, :media, [1, 2, 3, 4, 5])
      {:ok, 5}
  """
  def bulk_tag_resources(tag_id, resource_type, resource_ids) when is_list(resource_ids) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    entries =
      resource_ids
      |> Enum.map(fn resource_id ->
        %{
          tag_id: tag_id,
          resource_type: resource_type,
          resource_id: resource_id,
          inserted_at: now,
          updated_at: now
        }
      end)

    case entries do
      [] ->
        {:ok, 0}

      _ ->
        {count, _} = Repo.insert_all(ResourceTag, entries, on_conflict: :nothing)
        {:ok, count}
    end
  end

  @doc """
  Removes a tag from multiple resources at once.

  ## Examples

      iex> bulk_untag_resources(tag_id, :media, [1, 2, 3, 4, 5])
      {:ok, 5}
  """
  def bulk_untag_resources(tag_id, resource_type, resource_ids) when is_list(resource_ids) do
    {count, _} =
      from(rt in ResourceTag,
        where:
          rt.tag_id == ^tag_id and rt.resource_type == ^resource_type and
            rt.resource_id in ^resource_ids
      )
      |> Repo.delete_all()

    {:ok, count}
  end

  # ============================================================================
  # Statistics
  # ============================================================================

  @doc """
  Counts the number of resources tagged with a specific tag.

  ## Examples

      iex> count_resources_with_tag(tag_id)
      42

      iex> count_resources_with_tag(tag_id, :media)
      15
  """
  def count_resources_with_tag(tag_id, resource_type \\ nil) do
    query = from(rt in ResourceTag, where: rt.tag_id == ^tag_id)

    query =
      if resource_type do
        from(rt in query, where: rt.resource_type == ^resource_type)
      else
        query
      end

    Repo.aggregate(query, :count)
  end

  @doc """
  Returns tag usage statistics for an organization.

  ## Examples

      iex> get_tag_usage_stats(org_id)
      [%{tag: %Tag{}, count: 42}, ...]
  """
  def get_tag_usage_stats(organization_id) do
    from(t in Tag,
      left_join: rt in ResourceTag,
      on: rt.tag_id == t.id,
      where: t.organization_id == ^organization_id,
      group_by: t.id,
      select: %{tag: t, count: count(rt.resource_id)},
      order_by: [desc: count(rt.resource_id), asc: t.name]
    )
    |> Repo.all()
  end
end
