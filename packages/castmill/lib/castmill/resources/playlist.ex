defmodule Castmill.Resources.Playlist do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @derive {Jason.Encoder,
           only: [:id, :name, :status, :items, :settings, :inserted_at, :updated_at]}
  schema "playlists" do
    field :name, :string
    field :status, Ecto.Enum, values: [:draft, :live]

    # Settings will hold stuff like
    # volume, loop, aspect ratio, auto_zoom,
    field :settings, :map

    belongs_to :organization, Castmill.Organizations.Organization, foreign_key: :organization_id, type: Ecto.UUID
    belongs_to :resource, Castmill.Resources.Resource, foreign_key: :resource_id

    many_to_many :items,
      Castmill.Widgets.WidgetConfig,
      join_through: "playlists_items",
      on_replace: :delete

    timestamps()
  end

  @doc false
  def changeset(playlist, attrs) do
    playlist
    |> cast(attrs, [:name, :settings, :organization_id, :resource_id])
    |> validate_required([:name, :organization_id])
  end

  def base_query() do
    from playlist in Castmill.Resources.Playlist, as: :playlist
  end
end
