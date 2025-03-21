defmodule Castmill.Networks.Network do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID

  schema "networks" do
    field(:copyright, :string, default: "© 2024 Castmill AB")
    field(:domain, :string)
    field(:email, :string)
    field(:logo, :string, default: "https://castmill.com/images/logo.png")
    field(:name, :string)

    field(:meta, :map)

    has_many(:organizations, Castmill.Organizations.Organization)
    has_many(:users, Castmill.Accounts.User)

    timestamps()
  end

  @doc false
  def changeset(network, attrs) do
    network
    |> cast(attrs, [:name, :copyright, :email, :logo, :domain, :meta])
    |> validate_required([:name, :email])
    |> validate_format(:email, ~r/@/)
    |> unique_constraint(:name)
  end

  def base_query() do
    from(network in Castmill.Networks.Network, as: :network)
  end

  def where_name(query, nil) do
    query
  end

  def where_name(query, name) do
    from(network in query,
      where: network.name == ^name
    )
  end
end
