defmodule Castmill.Media do
  use Ecto.Schema
  import Ecto.Changeset

  schema "medias" do
    field :mimetype, :string
    field :name, :string
    field :size, :string
    field :uri, :string

    belongs_to :organization, Castmill.Organization

    timestamps()
  end

  @doc false
  def changeset(media, attrs) do
    media
    |> cast(attrs, [:name, :uri, :size, :mimetype])
    |> validate_required([:name, :uri, :size, :mimetype])
  end
end
