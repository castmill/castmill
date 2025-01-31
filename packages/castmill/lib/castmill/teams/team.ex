defmodule Castmill.Teams.Team do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  schema "teams" do
    field :name, :string

    belongs_to :organization, Castmill.Organizations.Organization, type: Ecto.UUID

    many_to_many :users, Castmill.Accounts.User, join_through: "teams_users", on_replace: :delete

    many_to_many :resources, Castmill.Accounts.User,
      join_through: "teams_resources",
      on_replace: :delete

    timestamps()
  end

  @doc false
  def changeset(team, attrs) do
    team
    |> cast(attrs, [:name, :organization_id])
    |> validate_required([:name, :organization_id])
    |> unique_constraint([:organization_id, :name], name: :unique_team_name_per_org)
  end

  def base_query() do
    from team in Castmill.Teams.Team, as: :team
  end

  def where_team_id(query, nil) do
    query
  end

  def where_team_id(query, "") do
    query
  end

  def where_team_id(query, id) do
    from(e in query,
      where: e.team_id == ^id
    )
  end
end

defimpl Jason.Encoder, for: Castmill.Teams.Team do
  def encode(%Castmill.Teams.Team{} = team, opts) do
    map = %{
      id: team.id,
      name: team.name,
      organization_id: team.organization_id,
      inserted_at: team.inserted_at,
      updated_at: team.updated_at
    }

    Jason.Encode.map(map, opts)
  end
end
