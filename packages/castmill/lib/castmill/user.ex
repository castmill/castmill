defmodule Castmill.User do
  use Ecto.Schema
  import Ecto.Changeset

  schema "users" do
    field :avatar, :string
    field :email, :string
    field :name, :string

    many_to_many :organizations, Castmill.Organization, join_through: "organizations_users", on_replace: :delete

    timestamps()
  end

  @doc false
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:name, :avatar, :email])
    |> validate_required([:name, :avatar, :email])
  end
end
