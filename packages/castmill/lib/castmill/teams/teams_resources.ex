defmodule Castmill.Teams.TeamsResources do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key(false)

  schema "teams_resources" do
    field :access, {:array, Ecto.Enum}, values: [:read, :write], default: [:read, :write]

    belongs_to :team, Castmill.Teams.Team, foreign_key: :team_id, primary_key: true
    belongs_to :resource, Castmill.Resources.Resource, foreign_key: :resource_id, primary_key: true

    timestamps()
  end

  @doc false
  def changeset(teams_resources, attrs) do
    teams_resources
    |> cast(attrs, [:access, :team_id, :resource_id])
    |> validate_required([:access, :team_id, :resource_id])
  end
end
