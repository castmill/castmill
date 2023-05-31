defmodule Castmill.Networks.Network do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID

  schema "networks" do
    field :copyright, :string, default: "© 2023 Castmill"
    field :default_language, :string, default: "en"
    field :domain, :string
    field :email, :string
    field :logo, :string, default: "https://castmill.com/images/logo.png"
    field :name, :string

    has_many :organizations, Castmill.Organizations.Organization
    has_many :users, Castmill.Accounts.User

    timestamps()
  end

  @doc false
  def changeset(network, attrs) do
    network
    |> cast(attrs, [:name, :copyright, :email, :logo, :domain, :default_language])
    |> validate_required([:name, :email, :default_language])
    |> validate_format(:email, ~r/@/)
    |> unique_constraint(:name)
  end
end
