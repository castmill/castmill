defmodule Castmill.Tags.TagGroup do
  @moduledoc """
  Schema for tag groups.

  Tag groups provide optional categorization for tags, such as:
  - "Location" (containing tags like "London Office", "NYC Office")
  - "Campaign" (containing tags like "Summer Sale 2026", "Holiday Promo")
  - "Department" (containing tags like "Marketing", "Sales")

  This helps users organize their tags in a meaningful way.
  """

  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @derive {Jason.Encoder,
           only: [
             :id,
             :name,
             :color,
             :icon,
             :position,
             :organization_id,
             :inserted_at,
             :updated_at
           ]}

  schema "tag_groups" do
    field :name, :string
    field :color, :string
    field :icon, :string
    field :position, :integer, default: 0

    belongs_to :organization, Castmill.Organizations.Organization,
      foreign_key: :organization_id,
      type: Ecto.UUID

    has_many :tags, Castmill.Tags.Tag

    timestamps()
  end

  @doc false
  def changeset(tag_group, attrs) do
    tag_group
    |> cast(attrs, [:name, :color, :icon, :position, :organization_id])
    |> validate_required([:name, :organization_id])
    |> validate_length(:name, min: 1, max: 100)
    |> validate_format(:color, ~r/^#[0-9A-Fa-f]{6}$/,
      message: "must be a valid hex color (e.g., #3B82F6)"
    )
    |> unique_constraint([:organization_id, :name], name: :unique_tag_group_name_per_org)
  end

  def base_query do
    from(tg in __MODULE__, as: :tag_group)
  end

  def where_organization_id(query, nil), do: query
  def where_organization_id(query, ""), do: query

  def where_organization_id(query, organization_id) do
    from(tg in query,
      where: tg.organization_id == ^organization_id
    )
  end

  def order_by_position(query) do
    from(tg in query,
      order_by: [asc: tg.position, asc: tg.name]
    )
  end
end
