defmodule Castmill.Organizations.OrganizationsInvitation do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  alias __MODULE__

  schema "organizations_invitations" do
    field :email, :string
    field :role, Ecto.Enum, values: [:admin, :regular, :guest]
    field :token, :string
    field :status, :string, default: "invited"
    field :expires_at, :utc_datetime

    belongs_to :organization, Castmill.Organizations.Organization,
      type: Ecto.UUID,
      primary_key: true

    timestamps()
  end

  @doc false
  def changeset(invitation, attrs) do
    invitation
    |> cast(attrs, [:email, :role, :organization_id, :token, :status, :expires_at])
    |> validate_required([:email, :organization_id, :token])
    |> unique_constraint(:token)
    |> unique_constraint([:organization_id, :email],
      name: :unique_organization_email_invite_active
    )
    # Optionally set an expiration if not already provided:
    |> maybe_set_default_expiration()
    # Optionally truncate the timestamp to the second:
    |> maybe_truncate_timestamp()
  end

  # no expiration set
  def expired?(%OrganizationsInvitation{expires_at: nil}), do: false

  def expired?(%OrganizationsInvitation{expires_at: expires_at}) do
    DateTime.compare(DateTime.utc_now(), expires_at) == :gt
  end

  defp maybe_set_default_expiration(changeset) do
    # Example: if no expires_at is provided, default to 7 days from now
    if get_change(changeset, :expires_at) == nil do
      put_change(changeset, :expires_at, DateTime.add(DateTime.utc_now(), 7 * 24 * 3600, :second))
    else
      changeset
    end
  end

  defp maybe_truncate_timestamp(changeset) do
    case get_change(changeset, :expires_at) do
      nil ->
        changeset

      datetime ->
        truncated = DateTime.truncate(datetime, :second)
        put_change(changeset, :expires_at, truncated)
    end
  end

  @doc """
  A base query for the OrganizationsUsers schema.
  """
  def base_query() do
    from(oi in __MODULE__, as: :organizations_invitations)
  end

  def where_organization_id(query, nil), do: query
  def where_organization_id(query, ""), do: query

  def where_organization_id(query, organization_id) do
    from(ou in query,
      where: ou.organization_id == ^organization_id
    )
  end
end

defimpl Jason.Encoder, for: Castmill.Organizations.OrganizationsInvitation do
  def encode(%Castmill.Organizations.OrganizationsInvitation{} = organization_invitation, opts) do
    organization_name =
      if Ecto.assoc_loaded?(organization_invitation.organization) and
           organization_invitation.organization do
        organization_invitation.organization.name
      else
        nil
      end

    map = %{
      id: organization_invitation.id,
      email: organization_invitation.email,
      role: organization_invitation.role,
      organization_id: organization_invitation.organization_id,
      token: organization_invitation.token,
      status: organization_invitation.status,
      expires_at: organization_invitation.expires_at,
      inserted_at: organization_invitation.inserted_at,
      updated_at: organization_invitation.updated_at,
      organization_name: organization_name
    }

    Jason.Encode.map(map, opts)
  end
end
