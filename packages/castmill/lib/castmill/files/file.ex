defmodule Castmill.Files.File do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  schema "files" do
    field :name, :string
    field :size, :integer
    field :uri, :string
    field :mimetype, :string

    field :meta, :map

    belongs_to :organization, Castmill.Organizations.Organization, foreign_key: :organization_id, type: Ecto.UUID

    timestamps()
  end

  @doc false
  def changeset(file, attrs) do
    file
    |> cast(attrs, [:name, :uri, :size, :mimetype, :organization_id])
    |> validate_required([:name, :uri, :size, :mimetype, :organization_id])
    |> unique_constraint([:name, :organization_id], name: :files_name_organization_id_index)

  end

  def base_query() do
    from file in Castmill.Files.File, as: :file
  end

end
