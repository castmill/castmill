defmodule Castmill.Teams.TeamsUsers do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key false

  schema "teams_users" do
    field :role, Ecto.Enum, values: [:regular, :admin]

    belongs_to :team, Castmill.Teams.Team, foreign_key: :team_id, primary_key: true

    belongs_to :user, Castmill.Accounts.User,
      type: Ecto.UUID,
      foreign_key: :user_id,
      primary_key: true

    timestamps()
  end

  @doc false
  def changeset(teams_users, attrs) do
    teams_users
    |> cast(attrs, [:team_id, :user_id, :role])
    |> validate_required([:team_id, :user_id, :role])
    |> unique_constraint([:team_id, :user_id], name: :teams_users_pkey)
  end

  @doc """
  A base query for the TeamsUsers schema.
  """
  def base_query() do
    from(tu in __MODULE__, as: :teams_users)
  end

  def where_team_id(query, nil), do: query
  def where_team_id(query, ""), do: query

  def where_team_id(query, team_id) do
    from(tu in query,
      where: tu.team_id == ^team_id
    )
  end
end

defimpl Jason.Encoder, for: Castmill.Teams.TeamsUsers do
  def encode(%Castmill.Teams.TeamsUsers{} = team_users, opts) do
    base_map = %{
      team_id: team_users.team_id,
      user_id: team_users.user_id,
      role: team_users.role,
      inserted_at: team_users.inserted_at,
      updated_at: team_users.updated_at
    }

    # Only embed user if it’s actually preloaded
    # (Ecto.assoc_loaded? avoids errors if user not loaded)
    map =
      if Ecto.assoc_loaded?(team_users.user) and team_users.user do
        Map.put(base_map, :user, team_users.user)
      else
        base_map
      end

    Jason.Encode.map(map, opts)
  end
end
