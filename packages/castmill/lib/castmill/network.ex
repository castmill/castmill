defmodule Castmill.Network do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "networks" do
    field :copyright, :string
    field :default_language, :string
    field :domain, :string
    field :email, :string
    field :logo, :string
    field :name, :string

    has_many :organizations, Castmill.Organization

    timestamps()
  end

  @doc false
  def changeset(network, attrs) do
    network
    |> cast(attrs, [:name, :copyright, :email, :logo, :domain, :default_language])
    |> validate_required([:name, :email, :default_language])
  end
end
