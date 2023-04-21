defmodule Castmill.Resources.Playlist do
  use Ecto.Schema
  import Ecto.Changeset

  schema "playlists" do
    field :name, :string
    field :status, Ecto.Enum, values: [:draft, :live]

    # Settings will hold stuff like
    # volume, loop, aspect ratio, auto_zoom,
    field :settings, :map

    belongs_to :organization, Castmill.Organizations.Organization, foreign_key: :organization_id, type: Ecto.UUID
    belongs_to :resource, Castmill.Resources.Resource, foreign_key: :resource_id

    many_to_many :widgets,
      Castmill.Widgets.Widget,
      join_through: "playlist_items",
      on_replace: :delete

    timestamps()
  end

  @doc false
  def changeset(playlist, attrs) do
    playlist
    |> cast(attrs, [:name, :settings, :organization_id, :resource_id])
    |> validate_required([:name, :organization_id])
  end
end
