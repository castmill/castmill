defmodule Castmill.Teams.Invitation do
  use Ecto.Schema
  import Ecto.Changeset
  alias __MODULE__

  schema "invitations" do
    field :email, :string
    field :token, :string
    field :status, :string, default: "invited"
    field :expires_at, :utc_datetime

    belongs_to :team, Castmill.Teams.Team

    timestamps()
  end

  @doc false
  def changeset(invitation, attrs) do
    invitation
    |> cast(attrs, [:email, :team_id, :token, :status, :expires_at])
    |> validate_required([:email, :team_id, :token])
    |> unique_constraint(:token)
    |> unique_constraint([:team_id, :email], name: :unique_team_email_invite_active)
    # Optionally set an expiration if not already provided:
    |> maybe_set_default_expiration()
    # Optionally truncate the timestamp to the second:
    |> maybe_truncate_timestamp()
  end

  # no expiration set
  def expired?(%Invitation{expires_at: nil}), do: false

  def expired?(%Invitation{expires_at: expires_at}) do
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
end

defimpl Jason.Encoder, for: Castmill.Teams.Invitation do
  def encode(%Castmill.Teams.Invitation{} = team_invitation, opts) do
    team_name =
      if Ecto.assoc_loaded?(team_invitation.team) and team_invitation.team do
        team_invitation.team.name
      else
        nil
      end

    map = %{
      id: team_invitation.id,
      email: team_invitation.email,
      team_id: team_invitation.team_id,
      token: team_invitation.token,
      status: team_invitation.status,
      expires_at: team_invitation.expires_at,
      inserted_at: team_invitation.inserted_at,
      updated_at: team_invitation.updated_at,
      team_name: team_name
    }

    Jason.Encode.map(map, opts)
  end
end
