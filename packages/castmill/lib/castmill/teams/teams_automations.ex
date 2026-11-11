defmodule Castmill.Teams.TeamsAutomations do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key false

  schema "teams_automations" do
    field :access, {:array, Ecto.Enum},
      values: [:read, :write, :delete],
      default: [:read, :write, :delete]

    belongs_to :team, Castmill.Teams.Team, foreign_key: :team_id, primary_key: true

    belongs_to :automation, Castmill.Automations.Automation,
      foreign_key: :automation_id,
      primary_key: true

    timestamps()
  end

  @doc false
  def changeset(teams_automations, attrs) do
    teams_automations
    |> cast(attrs, [:access, :team_id, :automation_id])
    |> validate_required([:access, :team_id, :automation_id])
    |> unique_constraint([:team_id, :automation_id], name: :teams_automations_pkey)
  end

  @doc """
  A base query for the TeamsAutomations schema.
  """
  def base_query() do
    from(tl in __MODULE__, as: :teams_automations)
  end

  @doc """
  A bare query with no named binding.
  """
  def bare_query do
    from(tl in __MODULE__)
  end
end

defimpl Jason.Encoder, for: Castmill.Teams.TeamsAutomations do
  def encode(%Castmill.Teams.TeamsAutomations{} = teams_automations, opts) do
    base_map = %{
      team_id: teams_automations.team_id,
      automation_id: teams_automations.automation_id,
      access: teams_automations.access,
      inserted_at: teams_automations.inserted_at,
      updated_at: teams_automations.updated_at
    }

    Jason.Encode.map(base_map, opts)
  end
end
