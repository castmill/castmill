defmodule Castmill.Playlist do
  use Ecto.Schema
  import Ecto.Changeset

  schema "playlists" do
    field :entries, {:array, :map}
    field :name, :string

    belongs_to :organization, Castmill.Organization

    timestamps()
  end

  @doc false
  def changeset(playlist, attrs) do
    playlist
    |> cast(attrs, [:name, :entries])
    |> validate_required([:name, :entries])
  end
end
