defmodule Castmill.Resources.Media do
  use Ecto.Schema
  import Ecto.Changeset

  schema "medias" do
    field :mimetype, :string
    field :name, :string
    field :size, :integer
    field :uri, :string

    belongs_to :organization, Castmill.Organizations.Organization, foreign_key: :organization_id, type: Ecto.UUID

    timestamps()
  end

  @doc false
  def changeset(media, attrs) do
    media
    |> cast(attrs, [:name, :uri, :size, :mimetype, :organization_id])
    |> validate_required([:name, :uri, :size, :mimetype, :organization_id])
  end
end
