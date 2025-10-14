defmodule Castmill.Organizations.OrganizationsUsers do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key false

  schema "organizations_users" do
    # Castmill 2.0 RBAC Roles:
    # - :admin - Full access including org management
    # - :manager - Elevated access, can manage teams
    # - :member - Standard user (default), can manage content
    # - :editor - Full CRUD on content, cannot manage teams/org
    # - :publisher - Like editor + publish action
    # - :device_manager - Full device/channel management
    # - :guest - Read-only access
    field :role, Ecto.Enum,
      values: [:admin, :manager, :member, :editor, :publisher, :device_manager, :guest]

    belongs_to :organization, Castmill.Organizations.Organization,
      type: Ecto.UUID,
      primary_key: true

    belongs_to :user, Castmill.Accounts.User, type: Ecto.UUID, primary_key: true

    timestamps()
  end

  @doc false
  def changeset(organizations_users, attrs) do
    organizations_users
    |> cast(attrs, [:role, :organization_id, :user_id])
    |> validate_required([:role, :organization_id, :user_id])
    |> unique_constraint([:organization_id, :user_id])
  end

  @doc """
  A base query for the OrganizationsUsers schema.
  """
  def base_query() do
    from(ou in __MODULE__, as: :organizations_users)
  end

  def where_organization_id(query, nil), do: query
  def where_organization_id(query, ""), do: query

  def where_organization_id(query, organization_id) do
    from(ou in query,
      where: ou.organization_id == ^organization_id
    )
  end
end
