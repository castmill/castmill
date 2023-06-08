defmodule Castmill.Teams.TeamsUsers do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key(false)

  schema "teams_users" do
    field :role, Ecto.Enum, values: [:member, :admin]

    belongs_to :team, Castmill.Teams.Team, foreign_key: :team_id, primary_key: true
    belongs_to :user, Castmill.Accounts.User, type: Ecto.UUID, foreign_key: :user_id, primary_key: true

    timestamps()
  end

  @doc false
  def changeset(teams_users, attrs) do
    teams_users
    |> cast(attrs, [:team_id, :user_id, :role])
    |> validate_required([:team_id, :user_id, :role])
    |> unique_constraint([:team_id, :user_id], name: :teams_users_pkey)

  end
end
