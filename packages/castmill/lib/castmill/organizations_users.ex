defmodule Castmill.OrganizationsUsers do
  use Ecto.Schema
  import Ecto.Changeset

  schema "organizations_users" do
    field :role, :string

    timestamps()
  end

  @doc false
  def changeset(organizations_users, attrs) do
    organizations_users
    |> cast(attrs, [:role])
    |> validate_required([:role])
  end
end
