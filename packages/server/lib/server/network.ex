defmodule Server.Network do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "networks" do
    field :name, :string
    field :contact, :string
    field :copyright, :string
    field :domain, :string
    field :logo, :string
    field :default_language, :string

    has_many :organizations, Server.Organization

    timestamps()
  end

  @doc false
  def changeset(network, attrs) do
    network
    |> cast(attrs, [:name, :contact, :copyright, :domain, :logo, :default_language])
    |> validate_required([:name, :copyright, :contact])
  end
end
