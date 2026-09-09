defmodule Castmill.Tags.ResourceTag do
  @moduledoc """
  Schema for the polymorphic many-to-many relationship between tags and resources.

  This table allows any resource type (media, device, playlist, channel, etc.)
  to be associated with tags.

  ## Supported Resource Types

  - `:media` - Media files (images, videos, audio)
  - `:device` - Display devices
  - `:playlist` - Playlists
  - `:channel` - Channels

  ## Example

      # Associate a tag with a media
      %ResourceTag{
        tag_id: 1,
        resource_type: :media,
        resource_id: "42"
      }
  """

  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @resource_types [:media, :device, :playlist, :channel]

  @primary_key false

  @derive {Jason.Encoder,
           only: [
             :tag_id,
             :resource_type,
             :resource_id,
             :inserted_at,
             :updated_at
           ]}

  schema "resource_tags" do
    field :resource_type, Ecto.Enum, values: @resource_types, primary_key: true
    field :resource_id, :string, primary_key: true

    belongs_to :tag, Castmill.Tags.Tag, primary_key: true

    timestamps()
  end

  @doc """
  Returns the list of supported resource types.
  """
  def resource_types, do: @resource_types

  @doc false
  def changeset(resource_tag, attrs) do
    resource_tag
    |> cast(attrs, [:tag_id, :resource_type, :resource_id])
    |> validate_required([:tag_id, :resource_type, :resource_id])
    |> validate_inclusion(:resource_type, @resource_types)
    |> unique_constraint([:tag_id, :resource_type, :resource_id], name: :unique_tag_per_resource)
    |> foreign_key_constraint(:tag_id)
  end

  def base_query do
    from(rt in __MODULE__, as: :resource_tag)
  end

  @doc """
  Filter by tag_id.
  """
  def where_tag_id(query, nil), do: query

  def where_tag_id(query, tag_id) do
    from(rt in query, where: rt.tag_id == ^tag_id)
  end

  @doc """
  Filter by resource type and id.
  """
  def where_resource(query, resource_type, resource_id) do
    from(rt in query,
      where: rt.resource_type == ^resource_type and rt.resource_id == ^resource_id
    )
  end

  @doc """
  Filter by resource type.
  """
  def where_resource_type(query, nil), do: query

  def where_resource_type(query, resource_type) do
    from(rt in query, where: rt.resource_type == ^resource_type)
  end

  @doc """
  Filter by multiple tag IDs (for filtering resources by tags).
  """
  def where_tag_ids(query, []), do: query

  def where_tag_ids(query, tag_ids) when is_list(tag_ids) do
    from(rt in query, where: rt.tag_id in ^tag_ids)
  end

  @doc """
  Preloads the tag association.
  """
  def preload_tag(query) do
    from(rt in query, preload: [:tag])
  end

  @doc """
  Get resource IDs that have ALL of the specified tags (AND logic).
  """
  def resource_ids_with_all_tags(resource_type, tag_ids) when is_list(tag_ids) do
    tag_count = length(tag_ids)

    from(rt in __MODULE__,
      where: rt.resource_type == ^resource_type and rt.tag_id in ^tag_ids,
      group_by: rt.resource_id,
      having: count(rt.tag_id) == ^tag_count,
      select: rt.resource_id
    )
  end

  @doc """
  Get resource IDs that have ANY of the specified tags (OR logic).
  """
  def resource_ids_with_any_tags(resource_type, tag_ids) when is_list(tag_ids) do
    from(rt in __MODULE__,
      where: rt.resource_type == ^resource_type and rt.tag_id in ^tag_ids,
      distinct: true,
      select: rt.resource_id
    )
  end
end
