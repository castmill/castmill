defmodule Server.Media do
  use Ecto.Schema
  import Ecto.Changeset

  schema "medias" do
    field :mimetype, :string
    field :name, :string
    field :size, :integer
    field :uri, :string

    belongs_to :organization, Server.Organization

    timestamps()
  end

  @doc false
  def changeset(media, attrs) do
    media
    |> cast(attrs, [:name, :uri, :size, :mimetype])
    |> validate_required([:name, :uri, :size, :mimetype])
  end
end
