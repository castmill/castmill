defmodule Server.User do
  use Ecto.Schema
  import Ecto.Changeset

  schema "users" do
    field :avatar, :string
    field :name, :string

    many_to_many :organizations, Server.Organization, join_through: "organizations_users", on_replace: :delete

    timestamps()
  end

  @doc false
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:name, :avatar])
    |> validate_required([:name, :avatar])
  end
end
