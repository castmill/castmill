defmodule Castmill.Teams.TeamsLayouts do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key false

  schema "teams_layouts" do
    field :access, {:array, Ecto.Enum},
      values: [:read, :write, :delete],
      default: [:read, :write, :delete]

    belongs_to :team, Castmill.Teams.Team, foreign_key: :team_id, primary_key: true

    belongs_to :layout, Castmill.Resources.Layout,
      foreign_key: :layout_id,
      primary_key: true

    timestamps()
  end

  @doc false
  def changeset(teams_layouts, attrs) do
    teams_layouts
    |> cast(attrs, [:access, :team_id, :layout_id])
    |> validate_required([:access, :team_id, :layout_id])
    |> unique_constraint([:team_id, :layout_id], name: :teams_layouts_pkey)
  end

  @doc """
  A base query for the TeamsLayouts schema.
  """
  def base_query() do
    from(tl in __MODULE__, as: :teams_layouts)
  end

  @doc """
  A bare query with no named binding.
  """
  def bare_query do
    from(tl in __MODULE__)
  end
end

defimpl Jason.Encoder, for: Castmill.Teams.TeamsLayouts do
  def encode(%Castmill.Teams.TeamsLayouts{} = teams_layouts, opts) do
    base_map = %{
      team_id: teams_layouts.team_id,
      layout_id: teams_layouts.layout_id,
      access: teams_layouts.access,
      inserted_at: teams_layouts.inserted_at,
      updated_at: teams_layouts.updated_at
    }

    Jason.Encode.map(base_map, opts)
  end
end
