defmodule Castmill.Teams.TeamsMedias do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key false

  schema "teams_medias" do
    field :access, {:array, Ecto.Enum},
      values: [:read, :write, :delete],
      default: [:read, :write, :delete]

    belongs_to :team, Castmill.Teams.Team, foreign_key: :team_id, primary_key: true

    belongs_to :media, Castmill.Resources.Media,
      foreign_key: :media_id,
      primary_key: true

    timestamps()
  end

  @doc false
  def changeset(teams_medias, attrs) do
    teams_medias
    |> cast(attrs, [:access, :team_id, :media_id])
    |> validate_required([:access, :team_id, :media_id])
    |> unique_constraint([:team_id, :user_id], name: :teams_medias_pkey)
  end

  @doc """
  A base query for the TeamsMedias schema.
  """
  def base_query() do
    from(tm in __MODULE__, as: :teams_medias)
  end

  @doc """
  A bare query with no named binding.
  """
  def bare_query do
    from(tm in __MODULE__)
  end
end

defimpl Jason.Encoder, for: Castmill.Teams.TeamsMedias do
  def encode(%Castmill.Teams.TeamsMedias{} = team_medias, opts) do
    base_map = %{
      team_id: team_medias.team_id,
      media_id: team_medias.media_id,
      access: team_medias.access,
      inserted_at: team_medias.inserted_at,
      updated_at: team_medias.updated_at
    }

    # Only embed media if it’s actually preloaded
    # (Ecto.assoc_loaded? avoids errors if media not loaded)
    map =
      if Ecto.assoc_loaded?(team_medias.media) and team_medias.media do
        Map.put(base_map, :media, team_medias.media)
      else
        base_map
      end

    Jason.Encode.map(map, opts)
  end
end
