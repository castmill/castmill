defmodule Castmill.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, Ecto.UUID, autogenerate: true}

  schema "users" do
    field :avatar, :string
    field :email, :string
    field :name, :string

    many_to_many :organizations,
      Castmill.Organizations.Organization,
      join_through: "organizations_users",
      on_replace: :delete

    belongs_to :network, Castmill.Networks.Network, foreign_key: :network_id, type: Ecto.UUID

    has_many :access_tokens, Castmill.Accounts.AccessToken

    timestamps()
  end

  @doc false
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:name, :avatar, :email, :network_id])
    |> validate_required([:name, :email])
    |> validate_length(:name, min: 2, max: 20)
    |> validate_format(:avatar, ~r/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/)
    |> validate_format(:email, ~r/@/)
    |> unique_constraint([:email, :network_id], name: :users_name_network_id_index)
  end
end
