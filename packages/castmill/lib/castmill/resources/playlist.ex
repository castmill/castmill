defmodule Castmill.Resources.Playlist do
  use Ecto.Schema
  import Ecto.Changeset

  schema "playlists" do
    field :entries, {:array, :map}
    field :name, :string

    belongs_to :organization, Castmill.Organizations.Organization, foreign_key: :organization_id, type: Ecto.UUID

    timestamps()
  end

  @doc false
  def changeset(playlist, attrs) do
    playlist
    |> cast(attrs, [:name, :entries, :organization_id])
    |> validate_required([:name, :entries, :organization_id])
  end
end
