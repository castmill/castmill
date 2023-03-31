defmodule Server.OrganizationsUsers do
  use Ecto.Schema
  import Ecto.Changeset

  schema "organizations_users" do
    field :role, :date
  end

  @doc false
  def changeset(organizations_users, attrs) do
    organizations_users
    |> cast(attrs, [])
    |> validate_required([])
  end
end
