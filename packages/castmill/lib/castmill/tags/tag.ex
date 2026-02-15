defmodule Castmill.Tags.Tag do
  @moduledoc """
  Schema for tags.

  Tags are user-defined labels that can be attached to any resource type
  (medias, devices, playlists, channels) for organization and filtering.

  Unlike Teams, tags have no access control implications - they are purely
  for categorization and organization.

  Examples of tags:
  - "London Office" (location-based)
  - "Summer Sale 2026" (campaign-based)
  - "High Priority" (status-based)
  - "Archive" (workflow-based)
  """

  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  # Default color palette
  @default_color "#3B82F6"
  @color_palette [
    # Blue
    "#3B82F6",
    # Green
    "#10B981",
    # Amber
    "#F59E0B",
    # Red
    "#EF4444",
    # Purple
    "#8B5CF6",
    # Pink
    "#EC4899",
    # Cyan
    "#06B6D4",
    # Gray
    "#6B7280"
  ]

  @derive {Jason.Encoder,
           only: [
             :id,
             :name,
             :color,
             :position,
             :tag_group_id,
             :organization_id,
             :inserted_at,
             :updated_at
           ]}

  schema "tags" do
    field :name, :string
    field :color, :string, default: @default_color
    field :position, :integer, default: 0

    belongs_to :tag_group, Castmill.Tags.TagGroup

    belongs_to :organization, Castmill.Organizations.Organization,
      foreign_key: :organization_id,
      type: Ecto.UUID

    timestamps()
  end

  @doc """
  Returns the default color palette for tags.
  """
  def color_palette, do: @color_palette

  @doc """
  Returns the default tag color.
  """
  def default_color, do: @default_color

  @doc false
  def changeset(tag, attrs) do
    tag
    |> cast(attrs, [:name, :color, :position, :tag_group_id, :organization_id])
    |> validate_required([:name, :organization_id])
    |> validate_length(:name, min: 1, max: 100)
    |> validate_format(:color, ~r/^#[0-9A-Fa-f]{6}$/,
      message: "must be a valid hex color (e.g., #3B82F6)"
    )
    |> unique_constraint([:organization_id, :name], name: :unique_tag_name_per_org)
    |> foreign_key_constraint(:tag_group_id)
  end

  def base_query do
    from(t in __MODULE__, as: :tag)
  end

  def where_organization_id(query, nil), do: query
  def where_organization_id(query, ""), do: query

  def where_organization_id(query, organization_id) do
    from(t in query,
      where: t.organization_id == ^organization_id
    )
  end

  def where_tag_group_id(query, nil), do: query
  def where_tag_group_id(query, ""), do: query

  def where_tag_group_id(query, tag_group_id) do
    from(t in query,
      where: t.tag_group_id == ^tag_group_id
    )
  end

  def order_by_position(query) do
    from(t in query,
      order_by: [asc: t.position, asc: t.name]
    )
  end

  @doc """
  Preloads the tag_group association.
  """
  def preload_tag_group(query) do
    from(t in query, preload: [:tag_group])
  end
end
