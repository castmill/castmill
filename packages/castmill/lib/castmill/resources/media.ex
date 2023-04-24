defmodule Castmill.Resources.Media do
  use Ecto.Schema
  import Ecto.Changeset

  schema "medias" do
    field :mimetype, :string
    field :name, :string
    field :size, :integer
    field :uri, :string

    belongs_to :organization, Castmill.Organizations.Organization, foreign_key: :organization_id, type: Ecto.UUID
    belongs_to :resource, Castmill.Resources.Resource, foreign_key: :resource_id

    timestamps()
  end

  @doc false
  def changeset(media, attrs) do
    media
    |> cast(attrs, [:name, :uri, :size, :mimetype, :organization_id, :resource_id])
    |> validate_required([:name, :uri, :size, :mimetype, :organization_id])
  end

  def update_changeset(media, attrs) do
    media
    |> cast(attrs, [:name])
    |> validate_required([:name])
  end

end
