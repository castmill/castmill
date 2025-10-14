defmodule Castmill.Teams.Invitation do
  use Castmill.Schema
  import Ecto.Changeset
  alias __MODULE__

  schema "invitations" do
    field :email, :string
    field :token, :string
    field :status, :string, default: "invited"
    field :expires_at, :utc_datetime

    # Team roles: :admin (team manager), :member (regular member), :installer (temp device registration)
    field :role, Ecto.Enum, values: [:admin, :member, :installer], default: :member

    belongs_to :team, Castmill.Teams.Team

    timestamps()
  end

  @doc false
  def changeset(invitation, attrs) do
    invitation
    |> cast(attrs, [:email, :team_id, :token, :status, :expires_at, :role])
    |> validate_required([:email, :team_id, :token, :role])
    |> validate_not_expired()
    |> unique_constraint(:token)
    |> unique_constraint([:team_id, :email], name: :unique_team_email_invite_active)
    # Optionally set an expiration if not already provided:
    |> maybe_set_default_expiration()
    # Optionally truncate the timestamp to the second:
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
  def expired?(%Invitation{expires_at: nil}), do: false

  def expired?(%Invitation{expires_at: expires_at}) do
    DateTime.compare(DateTime.utc_now(), expires_at) == :gt
  end

  defp maybe_set_default_expiration(changeset) do
    # Set expiration based on role:
    # - Installer: 24 hours (temporary device registration tokens)
    # - Admin/Member: 7 days (standard invitation)
    if get_change(changeset, :expires_at) == nil do
      role = get_field(changeset, :role, :member)

      expiration_seconds =
        case role do
          # 24 hours for installer tokens
          :installer -> 24 * 3600
          # 7 days for regular invitations
          _ -> 7 * 24 * 3600
        end

      put_change(
        changeset,
        :expires_at,
        DateTime.add(DateTime.utc_now(), expiration_seconds, :second)
      )
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
end

defimpl Jason.Encoder, for: Castmill.Teams.Invitation do
  def encode(%Castmill.Teams.Invitation{} = team_invitation, opts) do
    team_name =
      if Ecto.assoc_loaded?(team_invitation.team) and team_invitation.team do
        team_invitation.team.name
      else
        nil
      end

    {organization_id, organization_name} =
      if Ecto.assoc_loaded?(team_invitation.team) && team_invitation.team &&
           Ecto.assoc_loaded?(team_invitation.team.organization) &&
           team_invitation.team.organization do
        {team_invitation.team.organization_id, team_invitation.team.organization.name}
      else
        {team_invitation.team && Map.get(team_invitation.team, :organization_id), nil}
      end

    map = %{
      id: team_invitation.id,
      email: team_invitation.email,
      team_id: team_invitation.team_id,
      token: team_invitation.token,
      status: team_invitation.status,
      role: team_invitation.role,
      expires_at: team_invitation.expires_at,
      inserted_at: team_invitation.inserted_at,
      updated_at: team_invitation.updated_at,
      team_name: team_name,
      organization_id: organization_id,
      organization_name: organization_name,
      expired: Castmill.Teams.Invitation.expired?(team_invitation)
    }

    Jason.Encode.map(map, opts)
  end
end
