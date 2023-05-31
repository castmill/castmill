defmodule Castmill.Organizations.OrganizationsUsersAccess do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key(false)

  schema "organizations_users_access" do
    field :access, :string, primary_key: true

    belongs_to :organization, Castmill.Organizations.Organization, type: Ecto.UUID, primary_key: true
    belongs_to :user, Castmill.Accounts.User, type: Ecto.UUID, primary_key: true

    timestamps()
  end

  @doc false
  def changeset(organizations_users, attrs) do
    organizations_users
    |> cast(attrs, [:access, :organization_id, :user_id])
    |> validate_required([:access, :organization_id, :user_id])
    |> unique_constraint([:access, :organization_id, :user_id])
  end
end
