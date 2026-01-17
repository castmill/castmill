defmodule Castmill.Networks.NetworkInvitation do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  alias __MODULE__

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID

  schema "network_invitations" do
    field :email, :string
    field :token, :string
    field :organization_name, :string
    field :status, :string, default: "invited"
    field :expires_at, :utc_datetime

    belongs_to :network, Castmill.Networks.Network,
      type: Ecto.UUID

    timestamps()
  end

  @doc false
  def changeset(invitation, attrs) do
    invitation
    |> cast(attrs, [:email, :organization_name, :network_id, :token, :status, :expires_at])
    |> validate_required([:email, :organization_name, :network_id, :token])
    |> validate_not_expired()
    |> unique_constraint(:token)
    |> unique_constraint([:network_id, :email],
      name: :unique_network_email_invite_active
    )
    |> maybe_set_default_expiration()
    |> maybe_truncate_timestamp()
  end

  # Validate that the invitation has not expired.
  defp validate_not_expired(changeset) do
    expires_at = get_field(changeset, :expires_at)

    if expires_at && DateTime.compare(DateTime.utc_now(), expires_at) == :gt do
      add_error(changeset, :expires_at, "invitation has expired")
    else
      changeset
    end
  end

  # no expiration set
  def expired?(%NetworkInvitation{expires_at: nil}), do: false

  def expired?(%NetworkInvitation{expires_at: expires_at}) do
    DateTime.compare(DateTime.utc_now(), expires_at) == :gt
  end

  defp maybe_set_default_expiration(changeset) do
    # Default to 7 days from now if no expiration is provided
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
  A base query for the NetworkInvitation schema.
  """
  def base_query() do
    from(ni in __MODULE__, as: :network_invitations)
  end

  def where_network_id(query, nil), do: query
  def where_network_id(query, ""), do: query

  def where_network_id(query, network_id) do
    from(ni in query,
      where: ni.network_id == ^network_id
    )
  end
end

defimpl Jason.Encoder, for: Castmill.Networks.NetworkInvitation do
  def encode(%Castmill.Networks.NetworkInvitation{} = invitation, opts) do
    map = %{
      id: invitation.id,
      email: invitation.email,
      organization_name: invitation.organization_name,
      network_id: invitation.network_id,
      token: invitation.token,
      status: invitation.status,
      expires_at: invitation.expires_at,
      inserted_at: invitation.inserted_at,
      updated_at: invitation.updated_at
    }

    Jason.Encode.map(map, opts)
  end
end
